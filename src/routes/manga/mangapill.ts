import { FastifyRequest, FastifyReply, FastifyInstance, RouteShorthandOptions } from 'fastify';
import fetch, { Response } from 'node-fetch';
import * as cheerio from 'cheerio';

// Define the base URL once
const MANGAPILL_BASE = 'https://mangapill.com';

// Define explicit types for query parameters
type SearchParams = { query: string };
type InfoParams = { id: string };
type ReadParams = { chapterId: string };

/**
 * Utility function for fetching and error checking
 * Uses node-fetch's Response type for better typing.
 */
const fetchData = async (url: string): Promise<string> => {
    const response: Response = await fetch(url);
    
    // Check for non-200 responses (e.g., 404, 500)
    if (!response.ok) {
        // Throw an error that includes the status for better debugging
        throw new Error(`Fetch failed with status: ${response.status} for URL: ${url}`);
    }
    return response.text();
};

const routes = async (fastify: FastifyInstance, options: RouteShorthandOptions) => {
  
    // --- Root route ---
    fastify.get('/', (_, reply) => {
        reply.status(200).send({
            intro: "Welcome to the Mangapill provider",
            routes: ['/:query', '/info?id=...', '/read?chapterId=...'],
            documentation: 'https://docs.consumet.org/#tag/mangapill',
        });
    });

// ---------------------------------------------------------------------------------------------------

    // --- Search manga ---
    fastify.get('/:query', async (request: FastifyRequest<{ Params: SearchParams }>, reply: FastifyReply) => {
        const { query } = request.params;
        
        try {
            if (!query || typeof query !== 'string') {
                return reply.status(400).send({ message: 'Search query is required.' });
            }

            const url = `${MANGAPILL_BASE}/search?query=${encodeURIComponent(query)}`;
            const html = await fetchData(url);
            const $ = cheerio.load(html);

            const results: any[] = [];
            
            // Use more specific selector for reliability
            $('div.manga-list > div.manga-item').each((i, el) => {
                // Find the anchor tag inside h3
                const anchor = $(el).find('h3 a');
                const imgEl = $(el).find('img');
                
                const title = anchor.text().trim();
                const mangaUrl = anchor.attr('href');
                
                // Extract ID from the URL path (e.g., 'manga-name-123')
                const id = mangaUrl ? mangaUrl.split('/').pop() : undefined;
                
                // Check for lazy loading attribute 'data-src' first, then 'src'
                const image = imgEl.attr('data-src') || imgEl.attr('src');
                
                // Only push results with valid ID, Title, and URL
                if (title && id && mangaUrl) {
                    results.push({ id, title, image, url: mangaUrl });
                }
            });

            // Apply a Cache-Control header for search results (e.g., 1 hour)
            reply.header('Cache-Control', 'public, max-age=3600'); 
            reply.status(200).send({ results });
        } catch (err) {
            console.error('Mangapill Search Error:', err);
            // Use 503 (Service Unavailable) if the upstream fetch failed
            reply.status(503).send({ message: 'Search failed due to upstream error.' });
        }
    });

// ---------------------------------------------------------------------------------------------------

    // --- Manga info / chapters ---
    fastify.get('/info', async (request: FastifyRequest<{ Querystring: InfoParams }>, reply: FastifyReply) => {
        const { id } = request.query;
        
        if (!id || typeof id !== 'string') {
            return reply.status(400).send({ message: 'Manga ID is required.' });
        }

        try {
            const url = `${MANGAPILL_BASE}/manga/${id}`;
            const html = await fetchData(url);
            const $ = cheerio.load(html);

            const chapters: any[] = [];
            
            // Select all chapter links within the chapter-list container
            $('div#chapters a').each((i, el) => {
                const chapterTitle = $(el).text().trim();
                const chapterUrl = $(el).attr('href');
                
                // The chapterId should be the unique path segment (e.g., 'chapter-name-123')
                const chapterId = chapterUrl ? chapterUrl.split('/').pop() : undefined; 

                if (chapterId && chapterTitle) {
                    chapters.push({ id: chapterId, title: chapterTitle, url: chapterUrl });
                }
            });
            
            // Optional: Extract other manga info (title, description, image, etc.)
            const mangaTitle = $('h1.font-bold').text().trim();
            const mangaImage = $('div.container > img').attr('src');
            
            reply.header('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
            reply.status(200).send({ 
                id,
                title: mangaTitle,
                image: mangaImage,
                chapters: chapters.reverse() // Chapters are often listed oldest first, reversing might be preferred
            });
        } catch (err) {
            console.error('Mangapill Info Error:', err);
            reply.status(503).send({ message: 'Failed to fetch manga info due to upstream error.' });
        }
    });

// ---------------------------------------------------------------------------------------------------

    // --- Read chapter pages ---
    fastify.get('/read', async (request: FastifyRequest<{ Querystring: ReadParams }>, reply: FastifyReply) => {
        const { chapterId } = request.query;
        
        if (!chapterId || typeof chapterId !== 'string') {
            return reply.status(400).send({ message: 'Chapter ID is required.' });
        }

        try {
            const url = `${MANGAPILL_BASE}/chapters/${chapterId}`;
            const html = await fetchData(url);
            const $ = cheerio.load(html);

            const images: string[] = [];
            
            // Select all image elements with the class 'page'
            $('img.page').each((i, el) => {
                // Check for 'data-src' (lazy loading) first, then 'src'
                const src = $(el).attr('data-src') || $(el).attr('src'); 
                if (src) images.push(src);
            });
            
            // Cache for a longer duration (1 day) since chapter content rarely changes
            reply.header('Cache-Control', 'public, max-age=86400');
            reply.status(200).send({ images });
        } catch (err) {
            console.error('Mangapill Read Error:', err);
            reply.status(503).send({ message: 'Failed to fetch chapter pages due to upstream error.' });
        }
    });
};

export default routes;
