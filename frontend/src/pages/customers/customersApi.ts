import type { Customer, CustomerKind } from './mockCustomers';

export type ApiCustomer = {
  id: number;
  code: string;
  title: string;
  phone: string;
  email: string;
  taxNo: string;
  taxOffice: string;
  taxOfficeId: number | null;
  kind: CustomerKind;
  accountType: string;
  accountTypeId: number | null;
  parentId: number | null;
  address: string;
  identityNo: string;
  childCount: number;
};

export type CustomerMeta = {
  accountTypes: { id: number; value: string; label: string; name: string }[];
  taxOffices: { id: number; value: string; label: string }[];
};

export function mapCustomer(c: ApiCustomer): Customer {
  return {
    id: String(c.id),
    code: c.code,
    title: c.title,
    phone: c.phone,
    email: c.email,
    taxNo: c.taxNo,
    taxOffice: c.taxOffice,
    taxOfficeId: c.taxOfficeId,
    kind: c.kind,
    accountType: c.accountType,
    accountTypeId: c.accountTypeId,
    parentId: c.parentId != null ? String(c.parentId) : null,
    address: c.address,
    identityNo: c.identityNo,
    childCount: c.childCount,
  };
}
