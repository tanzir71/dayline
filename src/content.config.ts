import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { guideSchema } from './content/guide-schema';

const guides = defineCollection({
  // ids are 'en/haircut-day', 'bn/haircut-day': the same slug exists once per language.
  loader: glob({
    base: './content/guides',
    pattern: '{en,bn}/*.md',
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: guideSchema,
});

export const collections = { guides };
