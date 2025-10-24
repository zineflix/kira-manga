import { FastifyRequest, FastifyReply, FastifyInstance, RegisterOptions } from 'fastify';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const MANGAPILL_BASE = 'https://mangapill.com';

const routes = async (fastify: FastifyInstance, options: RegisterOptions) => {
  
  // Utility function for fetching and error checking
  const fetchData = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Fetch failed with status: ${response.status} for URL: ${url}`);
    }
    return response.text();
  };

  // --- Root route ---
  fastify.get('/', (_, rp) => {
    rp.status(200).send({
      intro: "Welcome to the Mangapill provider",
      routes: ['/:query', '/info?id=...', '/read?chapterId=...'],
      documentation: 'https://docs.consumet.org/#tag/mangapill',
    });
  });

  // --- Search manga ---
  fastify.get('/:query', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = (request.params as { query: string }).query;
    
    try {
      const url = `${MANGAPILL_BASE}/search?query=${encodeURIComponent(query)}`;
      const html = await fetchData(url);
      const $ = cheerio.load(html);

      const results: any[] = [];
      $('div.manga-item').each((i, el) => {
        const title = $(el).find('h3 a').text().trim();
        const mangaUrl = $(el).find('h3 a').attr('href');
        const id = mangaUrl?.split('/').pop();
        const image = $(el).find('img').attr('data-src') || $(el).find('img').attr('src'); // Check data-src fallback

        // Ensure critical data exists before pushing
        if (title && id && mangaUrl) {
          results.push({ id, title, image, url: mangaUrl });
        }
      });
      
      // Suggestion: Use a short cache for search results
      reply.header('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      reply.status(200).send({ results });
    } catch (err) {
      console.error(err);
      reply.status(500).send({ message: 'Search failed' });
    }
  });

  // --- Manga info / chapters ---
  fastify.get('/info', async (request: FastifyRequest, reply: FastifyReply) => {
    const id = (request.query as { id: string }).id;
    if (!id || typeof id !== 'string') return reply.status(400).send({ message: 'id is required and must be a string' });

    try {
      const url = `${MANGAPILL_BASE}/manga/${id}`;
      const html = await fetchData(url);
      const $ = cheerio.load(html);

      const chapters: any[] = [];
      // Selector improved for specificity
      $('div.chapters a.chapter').each((i, el) => {
        const chapterTitle = $(el).text().trim();
        const chapterUrl = $(el).attr('href');
        // Use the full path segment as the ID for safety
        const chapterId = chapterUrl?.split('/').pop(); 

        if (chapterId && chapterTitle) {
          chapters.push({ id: chapterId, title: chapterTitle, url: chapterUrl });
        }
      });
      
      reply.header('Cache-Control', 'public, max-age=3600'); 
      reply.status(200).send({ chapters });
    } catch (err) {
      console.error(err);
      reply.status(500).send({ message: 'Failed to fetch manga info' });
    }
  });

  // --- Read chapter pages ---
  fastify.get('/read', async (request: FastifyRequest, reply: FastifyReply) => {
    const chapterId = (request.query as { chapterId: string }).chapterId;
    if (!chapterId || typeof chapterId !== 'string') return reply.status(400).send({ message: 'chapterId is required and must be a string' });

    try {
      const url = `${MANGAPILL_BASE}/chapters/${chapterId}`;
      const html = await fetchData(url);
      const $ = cheerio.load(html);

      const images: string[] = [];
      $('img.page').each((i, el) => {
        // Check for 'data-src' (lazy loading) first, then 'src'
        const src = $(el).attr('data-src') || $(el).attr('src'); 
        if (src) images.push(src);
      });
      
      // Note: Chapter page images are generally static, but we should not cache too long.
      reply.header('Cache-Control', 'public, max-age=43200'); // Cache for 12 hours
      reply.status(200).send({ images });
    } catch (err) {
      console.error(err);
      reply.status(500).send({ message: 'Failed to fetch chapter pages' });
    }
  });
};

export default routes;
