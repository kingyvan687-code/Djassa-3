import { Product } from '../types';

export const normalizeProductMedia = (product: Product): Product => {
  if (!product) return product;
  const mediaType = product.mediaType || (product.videoUrl ? 'video' : 'image');
  const images = Array.isArray(product.images) && product.images.length > 0 
    ? product.images 
    : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'];

  let variants = Array.isArray(product.variants) ? [...product.variants] : [];
  let variantImages = { ...(product.variantImages || {}) };

  // Clean and deduplicate any existing variants
  const otherGroups = variants.filter(v => v.type.toLowerCase() !== 'couleur' && v.type.toLowerCase() !== 'color');
  const otherGroupOptions = new Set(otherGroups.flatMap(v => v.options.map(o => o.toLowerCase())));
  
  variants = variants.map(v => {
    const isColor = v.type.toLowerCase() === 'couleur' || v.type.toLowerCase() === 'color';
    if (isColor && otherGroups.length > 0) {
      const cleanOptions = v.options.filter(o => {
        const lower = o.toLowerCase();
        if (['s', 'm', 'l', 'xl', 'xxl', '38', '39', '40', '41', '42', '43', '44', '45'].includes(lower)) return false;
        if (otherGroupOptions.has(lower)) return false;
        return true;
      });
      return { ...v, options: cleanOptions };
    }
    return { ...v, options: Array.from(new Set(v.options)) };
  }).filter(v => v.options.length > 0);

  // For prod-1 specifically, ensure the 3 rich color variants, size variants and images exist
  if (product.id === 'prod-1') {
    variantImages = {
      'Orange / Bleu': ['https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600'],
      'Vert Émeraude': ['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600'],
      'Jaune Soleil': ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600'],
      'S': ['https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600'],
      'M': ['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600'],
      'L': ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600'],
      'XL': ['https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=600'],
      ...variantImages
    };
    if (!variants.some((v) => v.type === 'Couleur')) {
      variants.unshift({
        type: 'Couleur',
        options: ['Orange / Bleu', 'Vert Émeraude', 'Jaune Soleil']
      });
    }
  } else if ((!variants || variants.length === 0) && variantImages && Object.keys(variantImages).length > 0) {
    variants.unshift({
      type: 'Couleur',
      options: Object.keys(variantImages)
    });
  }

  // Ensure size variants across all products also have dedicated high-quality photos
  const sizePresets: Record<string, string> = {
    'S': 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600',
    'M': 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600',
    'L': 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600',
    'XL': 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=600',
    'XXL': 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600',
    '39': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300',
    '40': 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=300',
    '41': 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=300',
    '42': 'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=300',
    '43': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300',
    '44': 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=300',
    '45': 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=300',
  };

  variants.forEach((v) => {
    const isSize = v.type.toLowerCase().includes('taille') || 
                   v.type.toLowerCase().includes('size') || 
                   v.type.toLowerCase().includes('pointure');
    if (isSize) {
      v.options.forEach((opt, idx) => {
        if (!variantImages[opt] || !variantImages[opt].length) {
          if (sizePresets[opt]) {
            variantImages[opt] = [sizePresets[opt]];
          } else if (images && images.length > 0) {
            variantImages[opt] = [images[idx % images.length]];
          }
        }
      });
    }
  });

  return {
    ...product,
    mediaType,
    images,
    variants,
    variantImages,
    videoUrl: product.videoUrl || '',
    videoPoster: product.videoPoster || images[0] || ''
  };
};
