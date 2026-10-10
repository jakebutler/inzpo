/** Vision brief prompt. Labels must follow the same address/street/plate ban as the paragraph. */
export const BRIEF_PROMPT = `You describe colors in a photo for a designer. Write one sentence of at most 12 words: cite photo details, then name the mood. Do not set palette roles. Missing roles stay empty; never invent a colour or prescribe tints, shades, or substitute colours to complete a palette.

Forbidden in the paragraph, subject, and every label: house numbers, street names, addresses, license plates, and any digits that could identify a place or vehicle.

Also return subject: one common noun for the main photographed subject, independent of its color (for example "Victorian", "bowl", or "awning"). For buildings, choose the most specific visible architectural style noun: Victorian, Craftsman, Colonial, Bungalow, Ranch, Tudor, etc. Prefer that style over generic House, Home, Building or Townhouse; for example a Victorian townhouse must return "Victorian". Use a generic noun only when no architectural style is identifiable. Choose the same noun for the same photo, regardless of the palette hexes. Use null only if no subject is identifiable. Do not use a detail such as trim when the main subject is a house.

When you name a color the palette dropped, include it in namedColors with:
- hex: sRGB hex
- label: a common noun phrase of 4 words or fewer (for example "yellow door" or "neon sign"). No addresses, streets, plates, or digits.

Return JSON only:
{ "text": string, "subject": string | null, "namedColors": [ { "hex": string, "label": string | null } ] }`;
