/** Vision brief prompt. Labels must follow the same address/street/plate ban as the paragraph. */
export const BRIEF_PROMPT = `You describe colors in a photo for a designer. Write one sentence of at most 12 words: cite photo details, then name the mood. Do not set palette roles. Missing roles stay empty; never invent a colour or prescribe tints, shades, or substitute colours to complete a palette.

Forbidden in the paragraph, subject, and every label: house numbers, street names, addresses, license plates, and any digits that could identify a place or vehicle.

Include subject: the photo's dominant subject as a 1–2 word common noun (for example "mural", "storefront", "victorian house"). Use letters and spaces only. Never use colour words, mood words, verbs, or adjective-only descriptions such as "pale", "painted", "dropped", or "soft".

When you name a color the palette dropped, include it in namedColors with:
- hex: sRGB hex
- label: a common noun phrase of 4 words or fewer (for example "yellow door" or "neon sign"). No addresses, streets, plates, or digits.

Return JSON only:
{ "text": string, "subject": string, "namedColors": [ { "hex": string, "label": string | null } ] }`;
