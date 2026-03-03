import { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

// --- Domain Types ---
export type Product = {
  name: string;
  productId: string;
  customization: string;
  size: string;
  quantity: number;
  thumbnailUrl: string;
  version: string;
};

export type Customer = {
  name: string;
  address: string;
  phone: string;
};

export type Order = {
  id: string;
  country: string;
  countryCode: string;
  date: string;
  status: 'Pending Production' | 'Shipped';
  customer: Customer;
  trackingNumber: string;
  items: Product[];
  note?: string;
};

export type FirestoreOrder = Omit<Order, 'date' | 'items' | 'customer'> & {
  date: Timestamp | string;
  items?: Product[];
  note?: string;
  customer: Omit<Customer, 'phone'> & { phone: string | number };
};

export type ExportType = 'pending' | 'shipped' | 'all';

export type CountryCode = 'ALL' | 'PT' | 'DE' | 'ES' | 'GB';

export type DateFilterState = {
  day: string;
  month: string;
  year: string;
};

// --- Zod Schema for the Edit Modal ---
export const editOrderSchema = z.object({
  customerName: z.string().min(1, 'Name is required'),
  customerAddress: z.string().min(1, 'Address is required'),
  customerPhone: z.string().min(1, 'Phone is required'),
  trackingNumber: z.string().optional(),
  note: z.string().optional(),
});

export type EditOrderSchema = z.infer<typeof editOrderSchema>;

// --- Constants ---
export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

const CURRENT_YEAR = new Date().getFullYear();
export const YEARS = Array.from({ length: 7 }, (_, i) => CURRENT_YEAR - 3 + i);

export const MAX_ORDERS_PER_PDF = 200;

export const ITEMS_PER_PAGE = 10;

export const PDF_LOADING_MESSAGES = [
  "Making your PDF look pretty...",
  "Printing pixels on invisible paper...",
  "Collecting all your orders in one place...",
  "Polishing thumbnails, hang on...",
  "Lining up rows and columns...",
  "Double-checking names and numbers...",
  "Almost there, don't go anywhere...",
  "Last touch, your PDF is coming...",
];

// --- Helpers ---
export const pad = (n: number) => n.toString().padStart(2, '0');
