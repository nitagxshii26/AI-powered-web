export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

        if (!OPENROUTER_API_KEY) {
            console.error("Missing OpenRouter API Key");
            return res.status(500).json({ error: 'Server configuration error.' });
        }

        // Construct the prompt for OpenRouter
        const prompt = `You are a study assistant. Generate exactly 5 flashcards based on the following text. 
Return ONLY a raw JSON array of objects, where each object has a "question" string and an "answer" string. Do not use markdown blocks, just raw JSON.

Text:
${text}

JSON format:
[
  {"question": "...", "answer": "..."},
  ...
]`;

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://aiflashcardgenerator.vercel.app', // Optional but recommended
                'X-Title': 'AI Flashcard Generator',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'google/gemini-pro', // Fallback to a fast/good model on OpenRouter, can be any model you prefer e.g. openai/gpt-3.5-turbo
                messages: [
                    { role: 'user', content: prompt }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error("OpenRouter Error:", errorData);
            return res.status(response.status).json({ error: 'Failed to fetch from OpenRouter' });
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error("Unexpected OpenRouter response:", data);
            throw new Error("Invalid response from OpenRouter API.");
        }
        
        const content = data.choices[0].message.content;

        // Try to parse the JSON
        try {
            // Strip any markdown code block formatting if the model ignored instructions
            let cleanContent = content.trim();
            if (cleanContent.startsWith('```json')) {
                cleanContent = cleanContent.replace(/^```json/, '').replace(/```$/, '');
            } else if (cleanContent.startsWith('```')) {
                cleanContent = cleanContent.replace(/^```/, '').replace(/```$/, '');
            }

            const flashcards = JSON.parse(cleanContent);
            
            // Validate structure
            if (!Array.isArray(flashcards) || flashcards.length === 0 || !flashcards[0].question) {
                throw new Error("Invalid format returned from AI.");
            }

            return res.status(200).json({ flashcards });
        } catch (parseError) {
            console.error("Failed to parse AI output:", content);
            return res.status(500).json({ error: 'AI returned malformed data. Please try again.' });
        }

    } catch (error) {
        console.error("Serverless Function Error:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
