/** City names are typed freely ("Indore , Madhya Pradesh", "indore"), so compare them loosely. */
export const cityKeyOf = (text) => String(text || '').split(',')[0].replace(/\s+/g, ' ').trim().toLowerCase();

export const cityLabelOf = (key) => String(key || '').replace(/\b\w/g, (c) => c.toUpperCase());
