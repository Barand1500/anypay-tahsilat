-- Test kullanıcı (Yönetici) — phpMyAdmin'de çalıştır
-- E-posta: 21baran51@gmail.com
-- Şifre: 123456
-- Rol: ROLE_YONETICI (rol_id=2)

INSERT INTO `user` (
  `musteri_id`, `email`, `is_verified`, `is_password`, `roles`, `password`,
  `adsoyad`, `unvan`, `telefon`, `resim`, `remove`, `reset_token`, `kar_marji`,
  `dogrulama`, `fb_token`, `last_login`, `apple_id`, `google_id`, `vega_entegre`,
  `two_factor`, `two_factor_type`, `sube_departman_id`, `rol_id`, `izinli_taksitler`
)
SELECT
  NULL,
  '21baran51@gmail.com',
  1,
  1,
  '["ROLE_YONETICI"]',
  '$2b$13$6I/b6qXTzbAesv11EiyQoeYKfeAO6CUOkoIuQjEiU65IPBbuR0Hi2',
  'Baran',
  'Yönetici',
  '000 000 00 00',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  2,
  '1,2,3,4,5,6,7,8,9,10,11,12'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `user` WHERE `email` = '21baran51@gmail.com'
);

-- Varsa şifre/rol güncelle
UPDATE `user`
SET
  `password` = '$2b$13$6I/b6qXTzbAesv11EiyQoeYKfeAO6CUOkoIuQjEiU65IPBbuR0Hi2',
  `is_verified` = 1,
  `is_password` = 1,
  `roles` = '["ROLE_YONETICI"]',
  `remove` = NULL,
  `rol_id` = 2,
  `unvan` = 'Yönetici',
  `izinli_taksitler` = '1,2,3,4,5,6,7,8,9,10,11,12'
WHERE `email` = '21baran51@gmail.com';
