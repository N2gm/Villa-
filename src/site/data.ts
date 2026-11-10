/** Content shared across routes. */

export const img = (id: string, w = 1600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`

export const projects = [
  { t: 'Family Apartment', c: 'Residential', y: '2024', img: img('photo-1700226034367-2fb120f48dfa', 1200), alt: 'Warm beige living room corner with an arched glazed door, brass wall sconce, abstract artwork and timber wainscoting' },
  { t: 'Custom Furniture', c: 'Decoration', y: '2024', img: img('photo-1663811397207-418a92396ad5', 1200), alt: 'Dark living room with a built-in media wall, illuminated shelving niches and slatted timber panels' },
  { t: 'Modern Villa', c: 'Architecture', y: '2023', img: img('photo-1721815693498-cc28507c0ba2', 1200), alt: 'Contemporary multi-storey villa facade at dusk with framed balconies, grey cladding and planting' },
  { t: 'Eco-friendly Residence', c: 'Residential', y: '2023', img: img('photo-1774551351897-c64cd76a7c22', 1200), alt: 'Living room with a charcoal sofa, gold circular artworks and a glowing branch sconce on a dark wall' },
  { t: 'Poolside Retreat', c: 'Luxurious Finishing', y: '2022', img: img('photo-1670589953882-b94c9cb380f5', 1200), alt: 'Long modern villa with floor-to-ceiling glazing beside a swimming pool under a blue sky' },
]
export type Project = (typeof projects)[number]

export const services = [
  { n: '1', title: 'Architecture', text: 'Concept-to-permit architectural design. Facades, massing and layouts engineered for light, flow and long-term value.', tags: ['Villas', 'Facades', 'Planning'], img: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=900&q=80' },
  { n: '2', title: 'Interior Work', text: 'Residential, commercial and administrative interiors where every material, joint and detail is considered.', tags: ['Residential', 'Commercial', 'Offices'], img: 'https://images.unsplash.com/photo-1648881806148-e5c51179c826?auto=format&fit=crop&w=900&q=80' },
  { n: '3', title: '2D / 3D Design', text: 'Precise 2D plans and photoreal 3D visualisation, so you walk through your space before a single wall is built.', tags: ['Floor plans', 'Renders', 'Walkthroughs'], img: 'https://images.unsplash.com/photo-1503387837-b154d5074bd2?auto=format&fit=crop&w=900&q=80' },
  { n: '4', title: 'Decoration Art', text: 'Furniture, lighting and styling curated to complete the story, delivered turnkey and ready to live in.', tags: ['Furniture', 'Lighting', 'Styling'], img: 'https://images.unsplash.com/photo-1564078516393-cf04bd966897?auto=format&fit=crop&w=900&q=80' },
]
export type Service = (typeof services)[number]
export const serviceByTitle = (t: string) => services.find((s) => s.title === t)!

export const contact = {
  phone: '01028993311',
  email: 'info@bonyan.com.eg',
  address: '20 Ibn Hani El Andalusi, Al Manteqa Al Oula, Nasr City, Cairo',
  whatsapp: 'https://api.whatsapp.com/send?phone=201028993311',
}

/**
 * Portfolio galleries, keyed by project title. The first image is the project
 * cover; the rest are stand-in Unsplash photos until the studio's own project
 * photography replaces them.
 */
export type GalleryShot = { src: string; alt: string; t: string; d: string }
export const stories: Record<string, { story: string; gallery: GalleryShot[] }> = {
  'Family Apartment': {
    story: 'A family home in warm neutrals, where arched glazing, brass light and timber panelling make every room feel calm and lived in.',
    gallery: [
      { src: img('photo-1700226034367-2fb120f48dfa'), alt: projects[0].alt, t: 'The arrival corner', d: 'An arched glazed door frames the light, balanced by a brass sconce and timber wainscoting.' },
      { src: img('photo-1678762200388-51e11225d4de'), alt: 'Bright living room with a large window, soft seating and a neutral palette', t: 'Living, opened up', d: 'One continuous room for the family, planned around the largest window.' },
      { src: img('photo-1682184805271-11671b7ecf4c'), alt: 'Modern living room with a wide window and low furniture', t: 'Low and quiet', d: 'Low furniture keeps sightlines open from the entrance to the view.' },
      { src: img('photo-1691036561573-4b76998b60de'), alt: 'Living room with an upholstered sofa and a large painting on the wall', t: 'Finished with art', d: 'Artwork and textiles were chosen last, to complete the palette rather than compete with it.' },
    ],
  },
  'Custom Furniture': {
    story: 'Joinery drawn and built to the millimetre: media walls, shelving and niches that turn storage into the room’s main feature.',
    gallery: [
      { src: img('photo-1663811397207-418a92396ad5'), alt: projects[1].alt, t: 'The media wall', d: 'A built-in wall with lit niches and slatted timber, hiding every cable and device.' },
      { src: img('photo-1770386482263-ed2340d6214e'), alt: 'Timber shelving with decorative objects and warm lamps', t: 'Shelving with light', d: 'Integrated lighting turns everyday objects into a composition.' },
      { src: img('photo-1567971685846-82fac9a7a5cb'), alt: 'Brown timber cabinet with fine grain', t: 'Grain, matched', d: 'Veneers are book-matched so the grain flows across every door.' },
      { src: img('photo-1787676053831-f27c5e771f23'), alt: 'Timber shelf with angled partitions holding books', t: 'Details that work', d: 'Angled partitions, soft-close fittings and shadow gaps: the details you feel daily.' },
    ],
  },
  'Modern Villa': {
    story: 'A contemporary villa composed of framed balconies and layered volumes, designed to glow at dusk and stay shaded at noon.',
    gallery: [
      { src: img('photo-1721815693498-cc28507c0ba2'), alt: projects[2].alt, t: 'The street facade', d: 'Framed balconies give depth and shade to every floor.' },
      { src: img('photo-1748063578185-3d68121b11ff'), alt: 'Modern house exterior glowing with warm interior light at dusk', t: 'After dark', d: 'Lighting is part of the architecture, planned with the facade.' },
      { src: img('photo-1719887805632-de5be825f72b'), alt: 'Modern house with large windows framed by palm trees', t: 'Landscape and glass', d: 'Planting screens the glazing and cools the approach.' },
      { src: img('photo-1608619769165-25647672335f'), alt: 'Brown concrete building in daylight with deep openings', t: 'Material and mass', d: 'Deep reveals and honest materials, built to age well in the Cairo sun.' },
    ],
  },
  'Eco-friendly Residence': {
    story: 'A residence designed to use less: daylight first, natural materials, and planting that brings the garden indoors.',
    gallery: [
      { src: img('photo-1774551351897-c64cd76a7c22'), alt: projects[3].alt, t: 'The evening room', d: 'Dark walls and warm, low-energy light for the evening hours.' },
      { src: img('photo-1592178036775-70c41f818c13'), alt: 'Green potted plant on a timber table', t: 'Natural materials', d: 'Solid timber, natural fibres and finishes free of harsh solvents.' },
      { src: img('photo-1606202598125-e2077bb5ebcc'), alt: 'Brown and black sofa set in a calm living room', t: 'Built to last', d: 'Fewer, better pieces, chosen to last for decades.' },
      { src: img('photo-1577614743689-c0b7d168a809'), alt: 'Green plants beside a bright window', t: 'Daylight first', d: 'Rooms are arranged so the day needs no artificial light.' },
    ],
  },
  'Poolside Retreat': {
    story: 'A long, low villa that opens completely to the pool, finished in stone and glass for slow afternoons outdoors.',
    gallery: [
      { src: img('photo-1670589953882-b94c9cb380f5'), alt: projects[4].alt, t: 'Glass to the water', d: 'Floor-to-ceiling glazing dissolves the line between living room and pool.' },
      { src: img('photo-1706164971302-e30c0640cc3b'), alt: 'Modern house with a swimming pool in front', t: 'The long elevation', d: 'One clean horizontal line, held low against the landscape.' },
      { src: img('photo-1763479142678-8e29f4edb538'), alt: 'Outdoor dining table and chairs beside a swimming pool', t: 'Dining outdoors', d: 'A shaded dining terrace for long Cairo evenings.' },
      { src: img('photo-1651376589881-0e5a7eb15ae4'), alt: 'Pool and house surrounded by planting', t: 'Water and planting', d: 'Planting softens the stone and gives the pool privacy.' },
    ],
  },
}
