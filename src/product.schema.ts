// The API uses MongoDB's `_id` inside a `{ data, message, success }` envelope.
export const productSchema = {
  type: 'object',
  required: [
    '_id', 'name', 'description', 'price', 'stock',
    'category', 'mainImage', 'subImages',
  ],
  properties: {
    _id: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
    name: { type: 'string', minLength: 1 },
    description: { type: 'string', minLength: 1 },
    price: { type: 'number' },
    stock: { type: 'number' },
    category: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
    mainImage: {
      type: 'object',
      required: ['url'],
      properties: { url: { type: 'string', minLength: 1 } },
    },
    subImages: { type: 'array' },
  },
} as const;
