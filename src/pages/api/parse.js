import formidable, { IncomingForm } from "formidable";
import fs from "fs/promises";
import pdfParse from "pdf-parse";
import { htmlToText } from "html-to-text";
import { OpenAI } from "openai";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false
  }
};

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Extracts text from uploaded file (PDF, HTML, or plain text)
async function extractText(file) {
  const data = await fs.readFile(file.filepath);

  if (file.mimetype === "application/pdf") {
    const pdfData = await pdfParse(data);
    return pdfData.text;
  } else if (file.mimetype === "text/html") {
    const html = data.toString("utf-8");
    return htmlToText(html, { 
      wordwrap: false,
      preserveNewlines: true 
    });
  } else {
    return data.toString("utf-8");
  }
}

// Extract URLs from text content
function extractLinks(content) {
  const linkRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
  return content.match(linkRegex) || [];
}

// Fetch content from URLs (with robust error handling)
async function fetchLinkedContent(url) {
  try {
    // Add timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: controller.signal,
      redirect: 'follow',
      // Remove the timeout property as it's not standard fetch API
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`HTTP error for ${url}: ${response.status} ${response.statusText}`);
      return '';
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      console.log(`Skipping non-text content from ${url}: ${contentType}`);
      return '';
    }

    const html = await response.text();
    
    // More robust HTML to text conversion
    const text = htmlToText(html, { 
      wordwrap: false,
      preserveNewlines: true,
      selectors: [
        // Remove common navigation/footer elements
        { selector: 'nav', format: 'skip' },
        { selector: 'footer', format: 'skip' },
        { selector: '.navigation', format: 'skip' },
        { selector: '.nav', format: 'skip' },
        { selector: '.menu', format: 'skip' },
        { selector: '.sidebar', format: 'skip' },
        { selector: '.advertisement', format: 'skip' },
        { selector: '.ads', format: 'skip' },
      ]
    });

    // Only return content if it's substantial
    if (text.trim().length < 100) {
      console.log(`Content too short from ${url}, skipping`);
      return '';
    }

    return text;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log(`Request timeout for ${url}`);
    } else {
      console.log(`Failed to fetch ${url}:`, error.message);
    }
    return '';
  }
}

// Validate file before processing
function validateFile(file) {
  const allowedTypes = [
    'application/pdf',
    'text/html',
    'text/plain',
    'application/octet-stream' // Sometimes PDFs come as this
  ];
  
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('File type not supported. Please upload PDF, HTML, or text files.');
  }
  
  if (file.size > maxSize) {
    throw new Error('File too large. Please upload files smaller than 10MB.');
  }
}

// Calculate total from individual components
function calculateTotalQuote(guestroomTotal, meetingRoomTotal, foodBeverageTotal) {
  const components = [guestroomTotal, meetingRoomTotal, foodBeverageTotal];
  const validComponents = components.filter(val => val !== null && val !== undefined && !isNaN(val));
  
  if (validComponents.length === 0) {
    return null;
  }
  
  return validComponents.reduce((sum, val) => sum + val, 0);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = new IncomingForm({
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 1
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Form parse error:", err);
      return res.status(500).json({ error: "Error parsing form data" });
    }

    try {
      let combinedText = fields.emailText?.[0] || "";

      // Handle file upload
      if (files.file) {
        const file = Array.isArray(files.file) ? files.file[0] : files.file;
        
        // Validate file
        validateFile(file);
        
        const fileText = await extractText(file);
        combinedText += "\n\n--- UPLOADED FILE CONTENT ---\n" + fileText;
      }

      // Check if we have any content
      if (!combinedText.trim()) {
        return res.status(400).json({ 
          error: "No content provided. Please paste email text or upload a file." 
        });
      }

      // Extract and fetch linked content with better error handling
      const links = extractLinks(combinedText);
      let linkedContentFetched = 0;
      let linkedContentErrors = [];

      if (links.length > 0) {
        console.log(`Found ${links.length} links, fetching content...`);
        
        // Process links concurrently but with error isolation
        const linkPromises = links.slice(0, 5).map(async (link) => { // Increased to 5 links
          try {
            const linkedContent = await fetchLinkedContent(link);
            if (linkedContent.trim()) {
              linkedContentFetched++;
              return `\n\n--- CONTENT FROM ${link} ---\n${linkedContent}`;
            }
            return '';
          } catch (error) {
            linkedContentErrors.push(`${link}: ${error.message}`);
            console.error(`Error fetching ${link}:`, error);
            return '';
          }
        });

        // Wait for all link fetches to complete (or fail)
        const linkResults = await Promise.allSettled(linkPromises);
        
        // Add successful content to combinedText
        linkResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            combinedText += result.value;
          }
        });

        console.log(`Successfully fetched content from ${linkedContentFetched}/${links.length} links`);
        if (linkedContentErrors.length > 0) {
          console.log('Link fetch errors:', linkedContentErrors);
        }
      }

      // Updated GPT prompt - removed totalQuote from extraction, focus on components
 const prompt = `
You are a hotel quote financial data extractor. Parse this hotel quote content and extract the following values.

IMPORTANT: Return ONLY valid JSON with these exact keys:
{
  "guestroomTotal": number | null,
  "meetingRoomTotal": number | null,
  "foodBeverageTotal": number | null,
  "confidence": number between 0 and 1,
  "aiNotes": "brief explanation of what was found or any issues",
  "calculationBreakdown": {
    "roomRate": number | null,
    "roomsPerNight": number | null,
    "numberOfNights": number | null,
    "calculatedTotal": number | null
  }
}

EXTRACTION RULES:
- Extract only the final numerical values (remove $, commas, currency symbols)
- Use null if a category is not found or explicitly $0
- DO NOT extract a total quote - focus only on the individual components

CRITICAL - COMPLIMENTARY vs MINIMUM HANDLING:
- If something is described as "complimentary", "free", "included", or "no charge" = extract as null (not a cost)
- F&B "minimums" are spending requirements, not additional costs - extract the minimum amount as foodBeverageTotal
- Meeting room costs that are "complimentary with F&B minimum" = extract meeting room as null (free)
- Don't double-count minimums as both meeting room cost AND F&B cost

GUESTROOM TOTAL CALCULATION:
1. FIRST: Look for an explicitly stated guestroom total dollar amount
2. IF NOT FOUND: Calculate using: Room Rate × Rooms per Night × Number of Nights
3. Look for these terms for room rate: "rate", "room rate", "nightly rate", "ROH rate", "group rate"
4. Look for these terms for room count: "rooms", "guestrooms", "room nights", "total rooms"
5. Calculate nights from check-in to check-out dates
6. In your calculationBreakdown, show: roomRate, roomsPerNight, numberOfNights, calculatedTotal
7. If you calculate the total, use that calculated amount as guestroomTotal

MEETING ROOM TOTAL:
- Look for meeting rooms, conference rooms, function space, event space RENTAL FEES
- IGNORE items labeled as "complimentary", "free", "included", or "no charge"
- IGNORE meeting space that is "complimentary with F&B minimum" - that means it's free

FOOD & BEVERAGE TOTAL:
- Look for F&B, food & beverage, catering, meals, breakfast, lunch, dinner COSTS
- Include F&B "minimums" as these represent required spending
- Look for phrases like "F&B minimum", "food & beverage minimum", "catering minimum"

EXAMPLES:
- "Complimentary meeting space with $50,000 F&B minimum" → meetingRoomTotal: null, foodBeverageTotal: 50000
- "$5,000 meeting room rental + $30,000 F&B minimum" → meetingRoomTotal: 5000, foodBeverageTotal: 30000
- "Free breakfast included" → foodBeverageTotal: null (unless other F&B costs exist)

VALIDATION:
- If multiple line items exist in a category, sum them up
- Confidence should reflect how certain you are (1.0 = very certain, 0.5 = somewhat certain, 0.2 = low certainty)
- In aiNotes, explain your reasoning, especially for complimentary items and minimums

Content to parse:
"""
${combinedText}
"""
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a precise financial data extractor specializing in hotel quotes. You must calculate guestroom totals when not explicitly provided. Return only valid JSON with no additional text or formatting."
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1, // Low temperature for consistency
        max_tokens: 1500 // Increased for calculation breakdown
      });

      let parsed;
      try {
        parsed = JSON.parse(completion.choices[0].message.content);
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        return res.status(500).json({ 
          error: "AI returned invalid JSON response",
          details: completion.choices[0].message.content
        });
      }

      // Validate the response structure (removed totalQuote from required fields)
      const requiredFields = ['guestroomTotal', 'meetingRoomTotal', 'foodBeverageTotal'];
      const hasAllFields = requiredFields.every(field => field in parsed);
      
      if (!hasAllFields) {
        console.error("Missing required fields in AI response:", parsed);
        return res.status(500).json({ error: "AI response missing required fields" });
      }

      // CALCULATE TOTAL QUOTE from components
      const calculatedTotal = calculateTotalQuote(
        parsed.guestroomTotal, 
        parsed.meetingRoomTotal, 
        parsed.foodBeverageTotal
      );
      
      // Add the calculated total to the response
      parsed.totalQuote = calculatedTotal;

      // Add metadata including link processing info
      parsed.processedAt = new Date().toISOString();
      parsed.hasLinkedContent = links.length > 0;
      parsed.linkedContentFetched = linkedContentFetched || 0;
      parsed.linkedContentErrors = linkedContentErrors || [];
      parsed.contentLength = combinedText.length;

      // Log the calculation for debugging
      console.log("Quote calculation:", {
        guestroom: parsed.guestroomTotal,
        meetingRoom: parsed.meetingRoomTotal,
        foodBeverage: parsed.foodBeverageTotal,
        calculatedTotal: calculatedTotal
      });

      // Save to Supabase with better error handling
      const { data: insertedData, error: supabaseError } = await supabase
        .from("quotes")
        .insert([
          {
            raw_content: combinedText.substring(0, 50000), // Limit content size for DB
            total_quote: parsed.totalQuote,
            guestroom_total: parsed.guestroomTotal,
            meeting_room_total: parsed.meetingRoomTotal,
            food_beverage_total: parsed.foodBeverageTotal,
            confidence: parsed.confidence,
            ai_notes: parsed.aiNotes,
            has_linked_content: parsed.hasLinkedContent,
            linked_content_fetched: parsed.linkedContentFetched,
            linked_content_errors: JSON.stringify(parsed.linkedContentErrors),
            content_length: parsed.contentLength,
            processed_at: parsed.processedAt,
            calculation_breakdown: JSON.stringify(parsed.calculationBreakdown)
          }
        ])
        .select();

      if (supabaseError) {
        console.error("Supabase insert error:", supabaseError);
        // Still return the parsed results even if DB save fails
        console.log("Continuing with parsed results despite DB error");
      }

      return res.status(200).json(parsed);

    } catch (error) {
      console.error("Processing error:", error);
      
      // Return more specific error messages
      if (error.message.includes('File type not supported')) {
        return res.status(400).json({ error: error.message });
      } else if (error.message.includes('File too large')) {
        return res.status(400).json({ error: error.message });
      } else if (error.message.includes('OpenAI')) {
        return res.status(500).json({ error: "AI service temporarily unavailable" });
      } else {
        return res.status(500).json({ 
          error: "Failed to parse quote",
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    }
  });
}