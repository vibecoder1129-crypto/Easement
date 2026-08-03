'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Booking, Business, Category, Review, Service, Staff, User, UserRole } from './types';
import {
  INITIAL_BOOKINGS,
  INITIAL_BUSINESSES,
  INITIAL_CATEGORIES,
  INITIAL_REVIEWS,
  INITIAL_SERVICES,
  INITIAL_STAFF,
} from './mockData';

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
}

interface AppContextType {
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  currentUser: User;
  setCurrentUser: (user: User) => void;

  categories: Category[];
  businesses: Business[];
  services: Service[];
  staff: Staff[];
  bookings: Booking[];
  reviews: Review[];

  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;

  // Booking Engine
  createBooking: (bookingData: Omit<Booking, 'id' | 'createdAt' | 'status'>) => Booking | null;
  cancelBooking: (bookingId: string) => void;
  updateBookingStatus: (bookingId: string, status: Booking['status']) => void;
  isSlotLockedOrBooked: (staffId: string, startDatetime: string, endDatetime: string) => boolean;
  temporaryLocks: Record<string, number>; // slot key -> expiration timestamp
  lockSlot: (staffId: string, startDatetime: string) => boolean;

  // Partner Management
  addService: (serviceData: Omit<Service, 'id'>) => void;
  updateService: (service: Service) => void;
  deleteService: (serviceId: string) => void;

  addStaff: (staffData: Omit<Staff, 'id' | 'rating' | 'reviewCount'>) => void;
  updateStaff: (staff: Staff) => void;

  addBusiness: (bizData: Omit<Business, 'id' | 'rating' | 'reviewCount' | 'status'>) => void;
  updateBusinessStatus: (bizId: string, status: Business['status']) => void;

  // Review Engine
  addReview: (reviewData: Omit<Review, 'id' | 'createdAt'>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'ezment_fresha_marketplace_v1_state';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRole, setActiveRole] = useState<UserRole>('consumer');
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'usr-consumer-default',
    name: 'Sarah Jenkins',
    email: 'sarah.j@example.com',
    phone: '+1 (555) 321-7654',
    role: 'consumer',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    noShowStrikes: 0,
  });

  const [categories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [businesses, setBusinesses] = useState<Business[]>(INITIAL_BUSINESSES);
  const [services, setServices] = useState<Service[]>(INITIAL_SERVICES);
  const [staff, setStaff] = useState<Staff[]>(INITIAL_STAFF);
  const [bookings, setBookings] = useState<Booking[]>(INITIAL_BOOKINGS);
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);

  const [temporaryLocks, setTemporaryLocks] = useState<Record<string, number>>({});
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.businesses) setBusinesses(parsed.businesses);
        if (parsed.services) setServices(parsed.services);
        if (parsed.staff) setStaff(parsed.staff);
        if (parsed.bookings) setBookings(parsed.bookings);
        if (parsed.reviews) setReviews(parsed.reviews);
      }
    } catch (e) {
      console.warn('Failed to load local state:', e);
    }
  }, []);

  // Save state to localStorage on state change
  useEffect(() => {
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({ businesses, services, staff, bookings, reviews })
      );
    } catch (e) {
      console.warn('Failed to save local state:', e);
    }
  }, [businesses, services, staff, bookings, reviews]);

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = 'toast-' + Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Slot Lock Simulation (Redis Lock Pattern)
  const lockSlot = (staffId: string, startDatetime: string): boolean => {
    const slotKey = `${staffId}_${startDatetime}`;
    const now = Date.now();
    const existingLockExp = temporaryLocks[slotKey];

    if (existingLockExp && existingLockExp > now) {
      addToast({
        type: 'warning',
        title: 'Slot Temporarily Reserved',
        message: 'Another user is currently completing checkout for this exact time slot. Please choose another slot.',
      });
      return false;
    }

    // Set 60 second lock
    setTemporaryLocks((prev) => ({
      ...prev,
      [slotKey]: now + 60000,
    }));
    return true;
  };

  const isSlotLockedOrBooked = (staffId: string, startDatetime: string, endDatetime: string): boolean => {
    const slotKey = `${staffId}_${startDatetime}`;
    const now = Date.now();

    // 1. Check temporary lock
    if (temporaryLocks[slotKey] && temporaryLocks[slotKey] > now) {
      return true;
    }

    // 2. Check DB overlapping booking (PostgreSQL exclusion constraint logic)
    const reqStart = new Date(startDatetime).getTime();
    const reqEnd = new Date(endDatetime).getTime();

    return bookings.some((b) => {
      if (b.staffId !== staffId || b.status === 'cancelled') return false;
      const bStart = new Date(b.startDatetime).getTime();
      const bEnd = new Date(b.endDatetime).getTime();
      // Overlap condition: start < bEnd AND end > bStart
      return reqStart < bEnd && reqEnd > bStart;
    });
  };

  const createBooking = (bookingData: Omit<Booking, 'id' | 'createdAt' | 'status'>): Booking | null => {
    // DB exclusion constraint verification
    if (isSlotLockedOrBooked(bookingData.staffId, bookingData.startDatetime, bookingData.endDatetime)) {
      addToast({
        type: 'error',
        title: 'Double-Booking Prevented',
        message: 'This slot was claimed just moments ago by another customer. Please select another slot.',
      });
      return null;
    }

    const newBooking: Booking = {
      ...bookingData,
      id: 'bk-' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      status: 'confirmed',
    };

    setBookings((prev) => [newBooking, ...prev]);

    // Release temporary lock
    const slotKey = `${bookingData.staffId}_${bookingData.startDatetime}`;
    setTemporaryLocks((prev) => {
      const copy = { ...prev };
      delete copy[slotKey];
      return copy;
    });

    addToast({
      type: 'success',
      title: 'Appointment Confirmed! 🎉',
      message: `Your booking at ${bookingData.businessName} is set for ${new Date(bookingData.startDatetime).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}. Pay $${bookingData.servicePrice} at store!`,
    });

    return newBooking;
  };

  const cancelBooking = (bookingId: string) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b))
    );
    addToast({
      type: 'info',
      title: 'Appointment Cancelled',
      message: 'Your booking has been cancelled and the slot returned to the public schedule.',
    });
  };

  const updateBookingStatus = (bookingId: string, status: Booking['status']) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status } : b))
    );
    addToast({
      type: 'info',
      title: 'Booking Status Updated',
      message: `Appointment updated to: ${status.replace('_', ' ').toUpperCase()}`,
    });
  };

  // Service Management
  const addService = (serviceData: Omit<Service, 'id'>) => {
    const newSvc: Service = {
      ...serviceData,
      id: 'srv-' + Math.random().toString(36).substr(2, 9),
    };
    setServices((prev) => [...prev, newSvc]);
    addToast({
      type: 'success',
      title: 'Service Added',
      message: `Added "${serviceData.name}" to menu at $${serviceData.price}.`,
    });
  };

  const updateService = (updated: Service) => {
    setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    addToast({
      type: 'success',
      title: 'Service Updated',
      message: `Updated service "${updated.name}".`,
    });
  };

  const deleteService = (serviceId: string) => {
    setServices((prev) => prev.filter((s) => s.id !== serviceId));
    addToast({
      type: 'info',
      title: 'Service Removed',
      message: 'Service has been deleted from your business menu.',
    });
  };

  // Staff Management
  const addStaff = (staffData: Omit<Staff, 'id' | 'rating' | 'reviewCount'>) => {
    const newStaffMember: Staff = {
      ...staffData,
      id: 'stf-' + Math.random().toString(36).substr(2, 9),
      rating: 5.0,
      reviewCount: 0,
    };
    setStaff((prev) => [...prev, newStaffMember]);
    addToast({
      type: 'success',
      title: 'Staff Member Onboarded',
      message: `Added ${staffData.name} to business roster.`,
    });
  };

  const updateStaff = (updated: Staff) => {
    setStaff((prev) => prev.map((st) => (st.id === updated.id ? updated : st)));
    addToast({
      type: 'success',
      title: 'Staff Member Updated',
      message: `Saved changes for ${updated.name}.`,
    });
  };

  // Business Management
  const addBusiness = (bizData: Omit<Business, 'id' | 'rating' | 'reviewCount' | 'status'>) => {
    const newBiz: Business = {
      ...bizData,
      id: 'biz-' + Math.random().toString(36).substr(2, 9),
      rating: 5.0,
      reviewCount: 0,
      status: 'pending_approval',
    };
    setBusinesses((prev) => [newBiz, ...prev]);
    addToast({
      type: 'info',
      title: 'Business Submitted for Approval',
      message: `"${bizData.name}" submitted to platform admin review!`,
    });
  };

  const updateBusinessStatus = (bizId: string, status: Business['status']) => {
    setBusinesses((prev) =>
      prev.map((b) => (b.id === bizId ? { ...b, status } : b))
    );
    addToast({
      type: 'success',
      title: 'Business Status Changed',
      message: `Listing status changed to ${status}.`,
    });
  };

  // Reviews
  const addReview = (reviewData: Omit<Review, 'id' | 'createdAt'>) => {
    const newReview: Review = {
      ...reviewData,
      id: 'rev-' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    setReviews((prev) => [newReview, ...prev]);

    // Recalculate business rating
    const bizReviews = [...reviews, newReview].filter((r) => r.businessId === reviewData.businessId);
    const avgRating = Number(
      (bizReviews.reduce((acc, curr) => acc + curr.rating, 0) / bizReviews.length).toFixed(2)
    );

    setBusinesses((prev) =>
      prev.map((b) =>
        b.id === reviewData.businessId
          ? { ...b, rating: avgRating, reviewCount: bizReviews.length }
          : b
      )
    );

    addToast({
      type: 'success',
      title: 'Review Published ⭐',
      message: 'Thank you for rating your service experience!',
    });
  };

  return (
    <AppContext.Provider
      value={{
        activeRole,
        setActiveRole,
        currentUser,
        setCurrentUser,
        categories,
        businesses,
        services,
        staff,
        bookings,
        reviews,
        toasts,
        addToast,
        removeToast,
        createBooking,
        cancelBooking,
        updateBookingStatus,
        isSlotLockedOrBooked,
        temporaryLocks,
        lockSlot,
        addService,
        updateService,
        deleteService,
        addStaff,
        updateStaff,
        addBusiness,
        updateBusinessStatus,
        addReview,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
