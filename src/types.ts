import { z } from "zod";

export const offerProductSchema = z.object({
  category: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  price: z.string().min(1),
  promotion: z.string(),
  unitPrice: z.string().min(1).optional(),
  deposit: z.string().min(1).optional(),
  bonusAmount: z.string().min(1).optional(),
  imageUrl: z.url().optional(),
});

export const offersResultSchema = z.object({
  sourceUrl: z.url(),
  scrapedAt: z.iso.datetime(),
  store: z.object({
    name: z.string().min(1),
    address: z.string().min(1),
  }),
  offerPeriod: z.string().min(1),
  productCount: z.number().int().nonnegative(),
  products: z.array(offerProductSchema),
});

export type OfferProduct = z.infer<typeof offerProductSchema>;
export type OffersResult = z.infer<typeof offersResultSchema>;
