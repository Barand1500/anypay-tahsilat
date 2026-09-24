/** Müşteri detay — kullanıcı / adres tipleri */

export type CustomerUser = {
  id: string;
  customerId: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  lastLogin: string | null;
  tempPassword?: string;
};

export type CustomerAddress = {
  id: string;
  customerId: string;
  label: string;
  address: string;
  contactName: string;
  contactNames?: string[];
  isDefault: boolean;
  country?: string;
  province?: string;
  district?: string;
  quarter?: string;
  neighborhood?: string;
  street?: string;
  directions?: string;
  ulkeId?: number;
  ilId?: number;
  ilceId?: number;
  semtId?: number;
  mahalleId?: number;
  sokakId?: number;
};

export function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
