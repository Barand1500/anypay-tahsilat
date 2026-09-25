/** Ayarlar › E-Posta — şablon tipleri */

export type SmtpSettings = {
  host: string;
  port: string;
  email: string;
  password: string;
  ssl: boolean;
  tls: boolean;
};

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
