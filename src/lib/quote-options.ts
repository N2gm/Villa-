/** Choices offered by the Get a Quote brief; shared by the form and the QuoteRequests schema. */
export const quoteOptions = {
  type: ["Apartment", "Villa", "Office", "Commercial space"],
  services: ["Architecture", "Interior design", "2D / 3D design", "Finishing & execution", "Furniture & styling"],
  size: ["Under 150 m²", "150 – 300 m²", "300 – 600 m²", "Over 600 m²"],
  when: ["Right away", "Within 3 months", "Within 6 months", "Just exploring"],
} as const
