export type UserRole = 'consumer' | 'business_owner' | 'staff' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
  noShowStrikes?: number;
}

export interface Service {
  id: string;
  businessId: string;
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
  category: string;
}

export interface Staff {
  id: string;
  businessId: string;
  name: string;
  title: string;
  avatarUrl: string;
  rating: number;
  reviewCount: number;
  workingHours: {
    dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
    startTime: string; // "09:00"
    endTime: string;   // "18:00"
  }[];
  servicesOffered: string[]; // service IDs
}

export interface TimeOff {
  id: string;
  staffId: string;
  startDatetime: string;
  endDatetime: string;
  reason: string;
}

export interface Business {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  category: string; // 'hair' | 'nails' | 'barber' | 'skin' | 'spa'
  address: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  timezone: string; // IANA e.g. "America/New_York"
  rating: number;
  reviewCount: number;
  imageUrl: string;
  galleryUrls: string[];
  status: 'active' | 'pending_approval' | 'suspended';
  openingHours: string;
  featured?: boolean;
}

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface Booking {
  id: string;
  businessId: string;
  businessName: string;
  consumerId: string;
  consumerName: string;
  consumerEmail: string;
  consumerPhone: string;
  staffId: string;
  staffName: string;
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  serviceDuration: number;
  startDatetime: string; // ISO String UTC
  endDatetime: string;   // ISO String UTC
  status: BookingStatus;
  paymentMethod: 'pay_at_store' | 'card_online';
  createdAt: string;
  notes?: string;
}

export interface Review {
  id: string;
  bookingId: string;
  businessId: string;
  consumerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  staffName?: string;
  serviceName?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  iconName: string;
  description: string;
  imageUrl: string;
  count: number;
}
