/** Ayarlar › E-Posta — şablon tipleri */

export type EmailTemplate = {
  id: string;
  typeKey: string;
  name: string;
  subject: string;
  body: string;
};

export type EmailSablonOption = {
  id: string;
  name: string;
  used: boolean;
};
