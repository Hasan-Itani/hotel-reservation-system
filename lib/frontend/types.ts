export type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  emailVerifiedAt: string | null;
  globalRoles: string[];
  hotelRoles: Array<{
    hotelId: string;
    hotelName: string;
    role: string;
  }>;
};

export type Hotel = {
  id: string;
  name: string;
  slug: string;
  city: string;
  country: string;
  timezone: string;
  currency: string;
  starRating: number | null;
};

export type AuthMeResponse =
  | {
      authenticated: true;
      user: AuthUser;
    }
  | {
      authenticated: false;
      user: null;
    };

export type LoginResponse = {
  message: string;
  user: AuthUser;
};

export type ForgotPasswordResponse = {
  message: string;
};

export type ResetPasswordResponse = {
  message: string;
};

export type LogoutResponse = {
  message: string;
};

export type HotelsResponse = {
  hotels: Hotel[];
};

export type ApiErrorResponse = {
  error: string;
};

export type DecimalJson = string | number;

export type RoomTypeAmenity = {
  id: string;
  name: string;
  icon: string | null;
};

export type RoomTypeImage = {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
};

export type RoomType = {
  id: string;
  hotelId: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: DecimalJson;
  capacityAdults: number;
  capacityChildren: number;
  bedType: string | null;
  roomSizeSqm: DecimalJson | null;
  createdAt: string;
  updatedAt?: string;
  images: RoomTypeImage[];
  amenities: RoomTypeAmenity[];
  _count?: {
    rooms: number;
    reservationRooms: number;
  };
};

export type RoomTypesResponse = {
  hotelId: string;
  roomTypes: RoomType[];
};

export type RoomTypeResponse = {
  message?: string;
  roomType: RoomType;
};

export type DeletedRoomTypeResponse = {
  message: string;
  roomType: {
    id: string;
    name: string;
    slug: string;
    deletedAt: string;
  };
};

export type RoomStatus =
  | "AVAILABLE"
  | "OCCUPIED"
  | "MAINTENANCE"
  | "OUT_OF_SERVICE"
  | "CLEANING";

export type ManageableRoomStatus = Exclude<RoomStatus, "OCCUPIED">;

export type RoomTypeSummary = {
  id: string;
  name: string;
  slug: string;
  basePrice: DecimalJson;
  capacityAdults: number;
  capacityChildren: number;
  bedType: string | null;
};

export type Room = {
  id: string;
  hotelId: string;
  roomTypeId: string;
  roomNumber: string;
  floor: number | null;
  status: RoomStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  roomType: RoomTypeSummary;
};

export type RoomsResponse = {
  hotelId: string;
  rooms: Room[];
};

export type RoomResponse = {
  message?: string;
  room: Room;
};

export type DeletedRoomResponse = {
  message: string;
  room: {
    id: string;
    roomNumber: string;
    deletedAt: string;
  };
};

export type HotelStaffRoleName = "HOTEL_ADMIN" | "MANAGER" | "RECEPTIONIST";

export type StaffRole = {
  id: string;
  name: HotelStaffRoleName | string;
  description: string | null;
};

export type StaffMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
  assignedAt: string;
  roles: StaffRole[];
};

export type StaffListResponse = {
  hotelId: string;
  hotelName: string;
  staff: StaffMember[];
};

export type StaffMemberResponse = {
  message?: string;
  staff: StaffMember;
};

export type DeleteStaffResponse = {
  message: string;
};

export type ReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED"
  | "NO_SHOW";

export type ReservationStatusAction =
  | "CONFIRM"
  | "CANCEL"
  | "CHECK_IN"
  | "CHECK_OUT"
  | "NO_SHOW";

export type HotelInquiryType =
  | "GENERAL"
  | "RESERVATION"
  | "PAYMENT"
  | "DINING"
  | "EVENT"
  | "OTHER";

export type HotelInquiryStatus = "NEW" | "READ" | "REPLIED" | "ARCHIVED";

export type PublicHotelInquiryCreateResponse = {
  message: string;
  inquiry: {
    id: string;
    hotelId: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string | null;
    inquiryType: HotelInquiryType;
    subject: string;
    message: string;
    status: HotelInquiryStatus;
    createdAt: string;
  };
};

export type AdminHotelInquiryItem = {
  id: string;
  hotelId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  inquiryType: HotelInquiryType;
  subject: string;
  message: string;
  status: HotelInquiryStatus;
  adminNote: string | null;
  readAt: string | null;
  repliedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  hotel: {
    id: string;
    name: string;
    slug: string;
  };
};

export type AdminHotelInquiriesResponse = {
  hotelId: string;
  inquiries: AdminHotelInquiryItem[];
};

export type AdminHotelInquiryUpdateResponse = {
  message: string;
  inquiry: AdminHotelInquiryItem;
};

export type ReservationRoom = {
  id: string;
  roomId: string | null;
  roomTypeId: string;
  nightlyPrice: DecimalJson;
  guests: number;
  room: {
    id: string;
    roomNumber: string;
    floor: number | null;
    status: RoomStatus;
  } | null;
  roomType: {
    id: string;
    name: string;
    slug: string;
    basePrice: DecimalJson;
    capacityAdults: number;
    capacityChildren: number;
    bedType: string | null;
  };
};

export type Reservation = {
  id: string;
  reservationNumber: string;
  hotelId: string;
  userId: string | null;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone: string | null;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  specialRequests: string | null;
  status: ReservationStatus;
  subtotal: DecimalJson;
  taxes: DecimalJson;
  total: DecimalJson;
  currency: string;
  discountAmount: DecimalJson;
  serviceFee: DecimalJson;
  createdAt: string;
  updatedAt?: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  noShowAt: string | null;
  cancellationReason: string | null;
  reservationRooms: ReservationRoom[];
};

export type ReservationsResponse = {
  hotelId: string;
  hotelName: string;
  reservations: Reservation[];
};

export type ReservationResponse = {
  message?: string;
  reservation: Reservation;
};

export type PaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

export type PaymentProvider =
  | "STRIPE"
  | "CASH"
  | "CARD_ON_ARRIVAL"
  | "MOCK_CARD"
  | "OTHER";

export type PaymentStatusAction =
  | "MARK_PAID"
  | "MARK_FAILED"
  | "MARK_REFUNDED"
  | "MARK_PARTIALLY_REFUNDED";

export type Payment = {
  id: string;
  reservationId: string;
  provider: PaymentProvider;
  providerReference: string | null;
  methodLabel: string | null;
  cardLast4: string | null;
  cardHolderName: string | null;
  isMock: boolean;
  amount: DecimalJson;
  currency: string;
  status: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentReservationSummary = {
  id: string;
  reservationNumber: string;
  status: ReservationStatus;
  total: DecimalJson;
  currency: string;
  guestFirstName?: string;
  guestLastName?: string;
  guestEmail?: string;
  payments?: Payment[];
};

export type ReservationPaymentsResponse = {
  reservation: PaymentReservationSummary & {
    payments: Payment[];
  };
};

export type PaymentMutationResponse = {
  message: string;
  payment: Payment;
  reservation: PaymentReservationSummary | null;
};

export type PublicHotelImage = {
  id: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

export type PublicHotelListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  country: string;
  city: string;
  addressLine1: string;
  starRating: number | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  currency: string;
  timezone: string;
  startingPrice: number | null;
  primaryImage: PublicHotelImage | null;
  roomTypeCount: number;
};

export type PublicHotelsResponse = {
  hotels: PublicHotelListItem[];
};

export type PublicHotelDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  country: string;
  city: string;
  addressLine1: string;
  addressLine2: string | null;
  postalCode: string | null;
  starRating: number | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  currency: string;
  timezone: string;
};

export type PublicHotelDetailResponse = {
  hotel: PublicHotelDetail;
};

export type PublicRoomTypeAmenity = {
  id: string;
  name: string;
  icon: string | null;
};

export type PublicRoomType = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  capacityAdults: number;
  capacityChildren: number;
  bedType: string | null;
  roomSizeSqm: number | null;
  totalRooms: number;
  images: PublicHotelImage[];
  amenities: PublicRoomTypeAmenity[];
};

export type PublicRoomTypesResponse = {
  hotel: {
    name: string;
    slug: string;
    currency: string;
  };
  roomTypes: PublicRoomType[];
};

export type PublicAvailabilityRoomType = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: DecimalJson;
  capacityAdults: number;
  capacityChildren: number;
  bedType: string | null;
  roomSizeSqm: DecimalJson | null;
  images: PublicHotelImage[];
  totalRooms: number;
  reservedRooms: number;
  availableRooms: number;
  isAvailable: boolean;
};

export type PublicAvailabilityResponse = {
  hotel: {
    id: string;
    name: string;
    slug: string;
    currency: string;
  };
  checkInDate: string;
  checkOutDate: string;
  roomTypes: PublicAvailabilityRoomType[];
};

export type PublicBookingRoom = {
  nightlyPrice: DecimalJson;
  guests: number;
  roomType: {
    id: string;
    name: string;
    slug: string;
    basePrice: DecimalJson;
    capacityAdults: number;
    capacityChildren: number;
    bedType: string | null;
  };
};

export type PublicReservationSummary = {
  reservationNumber: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone: string | null;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  specialRequests: string | null;
  status: ReservationStatus;
  subtotal: DecimalJson;
  taxes: DecimalJson;
  total: DecimalJson;
  currency: string;
  discountAmount: DecimalJson;
  serviceFee: DecimalJson;
  createdAt: string;
  rooms: PublicBookingRoom[];
};

export type PublicBookingCreateResponse = {
  message: string;
  reservation: PublicReservationSummary;
};

export type PublicBookingPayment = {
  methodLabel: string | null;
  cardLast4: string | null;
  isMock: boolean;
  amount: DecimalJson;
  currency: string;
  status: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
};

export type PublicBookingPaymentSummary = {
  total: DecimalJson;
  paid: DecimalJson;
  remaining: DecimalJson;
};

export type PublicBookingDetails = PublicReservationSummary & {
  hotel?: {
    id?: string;
    name: string;
    slug: string;
    city?: string;
    country?: string;
    addressLine1?: string;
    currency?: string;
  };
  payments?: PublicBookingPayment[];
  paymentSummary?: PublicBookingPaymentSummary;
};

export type PublicBookingLookupResponse = {
  message: string;
  booking: PublicBookingDetails;
};

export type PublicBookingDetailsResponse = {
  booking: PublicBookingDetails;
};

export type PublicBookingPaymentResponse = {
  message: string;
  payment: PublicBookingPayment;
  reservationNumber: string;
  reservationStatus: ReservationStatus;
  confirmedAt?: string | null;
  paymentSummary: PublicBookingPaymentSummary;
};

export type GuestRegisterResponse = {
  message: string;
};

export type VerifyEmailResponse = {
  message: string;
};

export type GuestBookingsResponse = {
  bookings: PublicBookingDetails[];
};

export type GuestProfileUpdateResponse = {
  message: string;
  user: AuthUser;
};

export type AdminGuestLatestReservation = {
  reservationNumber: string;
  status: ReservationStatus;
  checkInDate: string;
  checkOutDate: string;
  total: DecimalJson;
  currency: string;
  createdAt: string;
};

export type AdminGuestListItem = {
  key: string;
  userId: string | null;
  accountLinked: boolean;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string | null;
  failedLoginAttempts: number | null;
  lockedUntil: string | null;
  canUnlock: boolean;
  accountCreatedAt: string | null;
  totalReservations: number;
  totalBooked: DecimalJson;
  totalPaid: DecimalJson;
  latestReservation: AdminGuestLatestReservation | null;
};

export type AdminGuestsResponse = {
  hotelId: string;
  hotelName: string;
  guests: AdminGuestListItem[];
};

export type AdminGuestUnlockResponse = {
  message: string;
  guest: {
    id: string;
    failedLoginAttempts: number;
    lockedUntil: string | null;
  };
};

export type AuditLogActor = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
} | null;

export type AuditLogItem = {
  id: string;
  hotelId: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: unknown;
  createdAt: string;
  actor: AuditLogActor;
};

export type AdminAuditLogsResponse = {
  hotelId: string;
  hotelName: string;
  logs: AuditLogItem[];
  filters: {
    actions: string[];
    entityTypes: string[];
  };
};
