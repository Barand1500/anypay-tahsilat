/** Tanımlamalar › Sözleşmeler — şablon + footer bağlantısı */

export type ContractLinkId =
  | 'none'
  | 'kvkk'
  | 'hizmet'
  | 'guvenlik'
  | 'tahsilat'
  | 'iptal-iade'
  | 'iletisim'
  | 'uyelik';

export type ContractDef = {
  id: string;
  name: string;
  /** HTML veya düz metin; #degisken# yer tutucuları */
  body: string;
  link: ContractLinkId;
  order: number;
};

export const CONTRACT_LINK_OPTIONS: { id: ContractLinkId; label: string }[] = [
  { id: 'none', label: 'Bağlantı yok' },
  { id: 'kvkk', label: 'KVKK ve Aydınlatma Metni' },
  { id: 'hizmet', label: 'Hizmet Sözleşmesi' },
  { id: 'guvenlik', label: 'Güvenlik Bilgilendirmesi' },
  { id: 'tahsilat', label: 'Tahsilat Sözleşmesi' },
  { id: 'iptal-iade', label: 'İptal ve İade Politikası' },
  { id: 'iletisim', label: 'İletişim Bilgileri' },
  { id: 'uyelik', label: 'Üyelik Sözleşmesi' },
];

export const COMPANY_VARS = [
  'webSitesi',
  'unvan',
  'vergiTCNo',
  'vergiDairesi',
  'adres',
  'eposta',
  'telefon',
  'gsm',
  'fax',
] as const;

export const CUSTOMER_VARS = [
  'musteriKodu',
  'musteriVergiTCPassPortNo',
  'musteriVergiDairesi',
  'musteriUnvanAdSoyad',
  'musteriTelefon',
  'musteriEposta',
  'musteriAdres',
] as const;

export type ContractVarMap = Record<string, string>;

const LS_KEY = 'anypay.contracts.v1';

/** KVKK şablon (yönetim ekranı) — #unvan# vb. */
export const KVKK_TEMPLATE = `Veri sorumlusu olarak #unvan# veya Şirket için müşterileri, çalışanları ve ilişki içinde olduğu diğer gerçek kişilere ait kişisel verilerin korunması, büyük önem arz etmektedir. Kişisel verilerin işlenmesi ve korunması süreçleri için işbu Politika ve #unvan# bünyesindeki diğer yazılı politikalar ile yönetilen süreç ve hedeflenen gaye; müşterilerimizin, tedarikçilerimizin, çalışanlarımızın, çalışan adaylarımızın, ziyaretçilerimizin, iş birliği içinde olduğumuz kurum çalışanlarının, dahil olduğumuz #unvan# çalışanlarının ve üçüncü kişilerin kişisel verilerinin hukuka uygun biçimde işlenmesi ve korunmasıdır.

Bu kapsamda, 6698 sayılı Kanun ve ilgili mevzuat gereğince kişisel verilerin işlenmesi ve korunması için #unvan# tarafından gereken idari ve teknik tedbirler alınmaktadır.

TANIMLAR

Açık Rıza
Belirli bir konuya ilişkin, bilgilendirilmeye dayanan ve özgür iradeyle açıklanan rıza.

Anonim Hale Getirme
Kişisel verinin, kişisel veri niteliğini kaybedecek ve bu durumun geri alınamayacağı şekilde değiştirilmesidir. Ör: Maskeleme, toplulaştırma, veri bozma vb. tekniklerle kişisel verinin bir gerçek kişi ile ilişkilendirilemeyecek hale getirilmesi.

Başvuru Formu
Kişisel veri sahiplerinin haklarını kullanmak için yapacakları başvuruyu içeren "6698 Sayılı Kişisel Verilerin Korunması Kanunu Gereğince İlgili Kişi (Kişisel Veri Sahibi) Tarafından Veri Sorumlusuna Yapılacak Başvurulara İlişkin Başvuru Formu".

Çalışan Adayı
#unvan#'ne herhangi bir yolla iş başvurusunda bulunmuş ya da öz geçmiş ve ilgili bilgilerini açmış olan gerçek kişiler.

İş Ortağı
#unvan#'nin ticari faaliyetlerini yürütürken iş ortaklığı kurduğu taraflar.

Kişisel Verilerin İşlenmesi
Kişisel verilerin tamamen veya kısmen otomatik olan ya da herhangi bir veri kayıt sisteminin parçası olmak kaydıyla otomatik olmayan yollarla elde edilmesi, kaydedilmesi, depolanması, muhafaza edilmesi, değiştirilmesi, yeniden düzenlenmesi, açıklanması, aktarılması, devralınması, elde edilebilir hâle getirilmesi, sınıflandırılması ya da kullanılmasının engellenmesi gibi veriler üzerinde gerçekleştirilen her türlü işlem.

Kişisel Veri Sahibi
Kişisel verisi işlenen gerçek kişi. Örneğin; müşteri, personel, bayi, tedarikçi.

Kişisel Veri
Kimliği belirli veya belirlenebilir gerçek kişiye ilişkin her türlü bilgi. Dolayısıyla tüzel kişilere ilişkin bilgilerin işlenmesi Kanun kapsamında değildir. Örneğin; adı-soyadı, TCKN, e-posta, adres, doğum tarihi, kredi kartı numarası vb.

Özel Nitelikli Kişisel Veri
Irk, etnik köken, siyasi düşünce, felsefi inanç, din, mezhep veya diğer inançlar, kılık kıyafet, dernek, vakıf ya da sendika üyeliği, sağlık, cinsel hayat, ceza mahkumiyeti ve güvenlik tedbirleriyle ilgili veriler ile biometrik ve genetik veriler.

Tedarikçi
#unvan#'nin ticari faaliyetlerini yürütürken #unvan#'ne hizmet sunan taraflar.

Üçüncü Kişi
Politika kapsamında farklı bir şekilde tanımlanmamış olan, kişisel verileri politika kapsamında işlenen gerçek kişiler (Örn. Aile bireyleri, eski çalışanlar).

Veri İşleyen
Veri sorumlusunun verdiği yetkiye dayanarak onun adına kişisel veri işleyen gerçek ve tüzel kişi.

Veri Sorumlusu
Kişisel verilerin işlenme amaçlarını ve vasıtalarını belirleyen, verilerin sistematik bir şekilde tutulduğu yeri (veri kayıt sistemi) yöneten kişi. Bu politika kapsamında #unvan# veri sorumlusudur.

Verilerin Silinmesi
Şirket içindeki tüm ilgili kullanıcıların, kişisel veriye erişimin engellenecek şekilde şifrelenmesi ve sadece veri koruma sorumlusunun bu şifreye sahip olması durumunu ifade etmektedir.

Verilerin Yok Edilmesi
Kişisel verinin bir daha geri döndürülemeyecek bir biçimde fiziksel olarak veya teknolojik yöntemlerle tamamen ortadan kaldırılması durumunu ifade etmektedir.

Ziyaretçi
#unvan#'nin sahip olduğu fiziksel yerleşkelere çeşitli amaçlarla girmiş olan veya internet sitelerimizi ziyaret eden gerçek kişiler.

Politikanın Amacı
Bu Politika'nın temel amacı, #unvan# tarafından hukuka uygun bir biçimde yürütülen kişisel veri işleme faaliyeti ve kişisel verilerin korunmasına yönelik benimsenen sistemler konusunda açıklamalarda bulunmak, bu kapsamda tedarikçilerimizi, bayilerimizi, çalışanlarımızı, çalışan adaylarımızı, ziyaretçilerimizi, iş birliği içinde olduğumuz kurumların hissedar ve çalışanlarını ve üçüncü kişileri bilgilendirerek şeffaflık sağlamaktır.

Politikanın Kapsamı
İş bu Politika, aşağıdaki kişilere ait edindiğimiz kişisel verilerin işlenmesine ilişkin faaliyetlerimizi kapsamaktadır:
• İş ortaklarımızın çalışanı, temsilcisi,
• Tedarikçilerimizin çalışanı, temsilcisi,
• Müşterilerimiz ve potansiyel müşterilerimiz,
• Çalışan adayları, stajyerler ve stajyer adayları,
• İş başvurusu yapan çalışan ve/veya stajyer adayları ve referans gösterdikleri kişiler,
• Kamu/özel kurum ve kuruluşu çalışanları,
• #unvan# çalışanlarının aile üyeleri,
• Hukuken yetkili kişiler,
• Ziyaretçilerimiz,
• Diğer üçüncü kişiler.

İşlediğimiz Kişisel Veriler
Veri Sorumlusu sıfatıyla, aşağıdaki kişisel veriler dahil olmak üzere bir takım kişisel verilerinizi işlemekteyiz.

Kimlik Bilgisi — TCKN, Pasaport No, Nüfus Cüzdanı Seri No, Adı-Soyadı, fotoğraf, doğum yeri, doğum tarihi, yaşı, nüfusa kayıtlı olduğu yer, vukuatlı nüfus cüzdanı örneği, ehliyet fotokopileri
İletişim Bilgisi — Kişilerin e-posta, telefon numarası, cep telefonu, ev ve iş yeri adresi
Lokasyon — Bulunduğu yerin konum bilgileri
Aile Bireyleri Bilgisi — İlgili Kişinin çocukları, eşleri ile ilgili kimlik bilgisi, iletişim bilgisi vs.
Özlük Bilgisi — Bordro bilgileri, disiplin soruşturması, işe giriş-çıkış belgesi kayıtları, mal bildirimi bilgileri, öz geçmiş bilgileri, performans değerlendirme raporları
Hukuki İşlem Bilgisi — Adli makamlarla yazışmalardaki bilgiler, dava dosyasındaki bilgiler
Müşteri İşlem Bilgisi — Santral kayıtları, fatura, senet, çek bilgileri, müşteri talep ve şikayet bilgileri
Fiziksel Mekân Güvenliği Bilgisi — Çalışan ve ziyaretçilerin giriş çıkış kayıt bilgileri, kamera kayıtları
İşlem Güvenliği Bilgisi — IP adresi bilgileri, internet sitesi giriş çıkış bilgileri, şifre ve parola bilgileri
Risk Yönetimi Bilgisi — Ticari, teknik, idari risklerin yönetilmesi için işlenen bilgiler
Finansal Bilgi — Bilanço bilgileri, finansal performans bilgileri, kredi ve risk bilgileri, mal varlığı bilgileri
Mesleki Deneyim Bilgisi — Diploma bilgileri, gidilen kurslar, meslek içi eğitim bilgileri, sertifikalar, transkript bilgileri
Pazarlama Bilgisi — Alışveriş geçmişi bilgileri, anket, çerez kayıtları, kampanya çalışmasıyla elde edilen bilgiler
Görsel ve İşitsel Kayıtlar — Görsel ve işitsel kayıtlar vb.
Sağlık Bilgileri — Kan grubu bilgisi

Kişisel Veri Toplama Yöntemimiz
• E-posta, SMS, kartvizitler,
• Telefon, Faks,
• CCTV (Kapalı Devre Kamera Kayıtları),
• Çerezler (Cookies) ve benzer takip teknolojileri,
• Matbu ve elektronik form,
• Posta, kargo ya da kurye hizmetleri,
• Diğer fiziki ve elektronik ortamlar,
• Hizmet aldığımız tedarikçiler ve ajanslar.

Kişisel Veri İşleme Amaçlarımız
#unvan# olarak kişisel verilerinizin mahremiyetine oldukça önem veriyor ve KVKK Kanunu'nda belirtilen genel ilke ve işleme şartlarına uygun olarak kişisel verilerinizi topluyor ve aşağıdaki amaçlar ile sınırlı olarak işliyoruz.
• Ürün ve/veya hizmetlerimizin sunulabilmesi ve satış süreçlerinin yürütülmesi,
• Ürün ve/veya hizmet alım süreçlerinin yürütülmesi,
• İhtiyaçlarınız ve talepleriniz doğrultusunda ürün ve hizmetlerimizin güncellenmesi, özelleştirilmesi ve geliştirilmesi,
• Müşteri ilişkileri süreçlerinin yürütülmesi,
• İnternet sitesi üyelik işlemlerinin gerçekleştirilmesi,
• İnternet sitelerimizde ziyaretçilerimizin tecrübesini iyileştirmek, talep ve sorunları tespit etmek ve aramalarını hızlı sonuçlandırmak amacıyla çerezlerin yönetilmesi,
• İş süreçlerinizi analiz ederek, ürün ve hizmetlerimizin süreçlerinize uygun olarak hale getirilmesi,
• Müşteri memnuniyetine yönelik aktivitelerin yürütülmesi,
• Pazarlama faaliyetlerinin yürütülmesi, reklam /kampanya / promosyon süreçlerinin yürütülmesi,
• Cari kaydının açılması ve kaydının güncellenmesi,
• İş faaliyetlerimizin yönetilmesi, yürütülmesi ve denetlenmesi,
• Finans ve muhasebe işlerinin yürütülmesi,
• Bina ve tesislerimizin fiziksel mekân güvenliğinin sağlanması,
• Yazılımlarımızın ve sistemlerimizin güvenliğinin sağlanması,
• Çalışan adaylarının iş başvurularının değerlendirilmesi,
• Yasal mevzuatlara uyum sağlanmak ve hukuki yükümlülüklerimizin yerine getirilmesi.

Kişisel Verilerinizin Aktarılması
#unvan#, hukuka uygun olan kişisel veri işleme amaçları doğrultusunda, gerekli güvenlik önlemlerini alarak, kişisel veri sahibinin kişisel verilerini ve özel nitelikli kişisel verilerini çalışanlarımız, iş ortaklarımız, tedarikçilerimiz, şirket temsilcisi ve hukuken yetkili vekillerimiz ve hukuken yetkili kamu/özel kurum ve kuruluşlarına aktarabilmektedir.

Kişisel Verilerinizin Saklanması ve Güvenliğin Sağlanması
#unvan#, kişisel verilerin hukuka uygun işlenmesini sağlamak için, teknolojik imkânlar ve uygulama maliyetine göre teknik ve idari tedbirler almaktadır.

Özel Nitelikli Kişisel Veriler
#unvan# Özel Nitelikli Kişisel veri talep etmez. Çalışan veya çalışan adayları ile ilgili olarak dernek veya vakıf üyeliği, kan grubu bilgisi gibi özel nitelikli kişisel veriler için veri sahibinin açık rızası alınır.

Kişisel Verilerin İmhası
Kanun ve ilgili diğer kanun hükümlerine uygun olarak işlenmiş olmasına rağmen, işlenmesini ve saklanmasını gerektiren tüm sebeplerin ortadan kalkması hâlinde Kişisel Veriler, Veri Sahibinin talebi üzerine #unvan# tarafından silinir, yok edilir veya anonim hâle getirilir.

Kişisel Verilerinize İlişkin Haklarınız ve Başvuru
İlgili Kişi olarak, KVK Kanunu'nun 11. maddesi uyarınca kişisel verilerinize ilişkin bilgi talep etme, düzeltme, silme, itiraz ve zararların giderilmesi haklarına sahipsiniz. Başvurularınız en geç otuz gün içinde yanıtlanır.

#unvan#
Adres : #adres#
Telefon : #telefon#
E-Posta : #eposta#`;

/** Hizmet Sözleşmesi şablonu — #webSitesi# footer’da çözülür */
export const HIZMET_TEMPLATE = `KULLANIM ŞARTLARI

#webSitesi# web sitesine hoş geldiniz.

Bu web sitesinde sunulan hizmetlerin kullanım şartlarını, sitemize üye olarak veya hizmetlerimizden yararlanma aşamasında, bu sözleşmeyi kabul ettiğinizi beyan eden kutucuğu işaretleyerek kabul etmiş oluyorsunuz. #webSitesi# web sitesinde bulunan hizmetlerde kullanım özellik ve şartlarında önceden bir bildirimde bulunmaksızın, herhangi bir zamanda değişiklik yapma, yürürlükten kaldırma ve güncelleme haklarını saklı tutar.

ÜYELİK İŞLEMLERİ

#webSitesi# web sitesinde sağlanan hizmetler için siteye üye olmanız ve kayıt sırasında kayıt formunda istenen bilgileri tam ve doğru olarak sağlamanız gerekmektedir.

Bilgileriniz de değişiklik olduğu zaman, üyelik profilinize girerek ilgili bölümleri güncellemek sizin sorumluluğunuzdadır. Güncellenmemiş bilgilerden dolayı size ulaşamadığımız zaman sorumluluk size aittir.

Eğer bu hizmetleri işvereniniz hesabına kullanıyorsanız, bu kullanım şartlarını onun adına kabul etmeye yetkili olduğunuz anlamına gelmektedir.

Kayıt esnasında tarafınızca belirlenen şifreniz yalnızca sizin kullanımınız içindir. Sizin hesabınız ile yapılan bütün işlemlerin sorumluluğu tamamıyla size aittir. Bu sözleşmeyi onaylanarak bunu kabul ve teyit etmiş oluyorsunuz.

Bu sözleşmeyi onaylayarak şifrenizin veya hesabınızın haksız kullanımı durumunda #webSitesi# personelini hemen bilgilendirmeyi de peşinen kabul ediyorsunuz.

#webSitesi#, hesabınızın veya şifrenizin başkası tarafından kullanımı nedeniyle, bilginiz olsun veya olmasın, oluşacak zararınız ile ilgili herhangi bir yükümlülük kabul etmez. Ancak, hesabınızın veya şifrenizin başka bir kişi tarafından kullanımından #webSitesi# veya başka bir kişi veya kuruluş zarar görürse, bu zarardan siz sorumlu tutulabilirsiniz. Hesap sahibinin izni olmaksızın başka bir hesabı kullanmanız yasaktır.

GARANTİ VE FERAGAT

#webSitesi# ve sizin aranızda yapılan ayrı bir sözleşme ile açıkça belirlenmediği sürece, bu web sitesinden edinilen bütün hizmetler size olduğu haliyle sağlanmış olup, herhangi bir amaca uygunluk açısından veya başka bir açıdan herhangi bir garantiye tabi değildir.

#webSitesi# hiçbir şekilde tarafınız veya başka bir üçüncü kişi tarafından bu web sitesine erişimden, bu web sitesinin veya bu web sitesinden linkle yönlendirilmiş başka bir web sitesine erişimden veya bu web sitesinde yer alan hizmetlerin kullanımı vasıtasıyla uğranılmış dolaysız veya dolaylı bir zarardan, gelir veya veri kaybından veya başka bir zarardan sorumlu değildir.

BU WEB SİTESİNDE SAĞLANAN ÜÇÜNCÜ KİŞİLERE AİT İÇERİK

Bu web sitesi üçüncü kişiler tarafından sağlanmış içerik veya yazılımlar bulunmaktadır. Bu web sitesinde yer alan bütün üçüncü kişilere ait içerik ve yazılımlar için de yukarıda yer alan “GARANTİ VE FERAGAT” bölümü hükümleri geçerlidir.`;

/** Güvenlik Bilgilendirmesi şablonu */
export const GUVENLIK_TEMPLATE = `Güvenli ve Hızlı Sanal Ödeme Sitemize Hoş geldiniz...

Sitemizde yapacağınız tüm ödemelerde YÜKSEK GÜVENLİK standartları kullanılmaktadır. 2048 Bit SSL ve 3D Secure servisleri ile kişisel bilgilerinizi ve kredi kartı bilgilerinizi riske atmadan sitemizde ödeme yapabilirsiniz.

KREDİ KARTI GÜVENLİĞİ

Sitemizde kredi kartıyla yapacağınız ödemelerde güvenliğiniz için ileri teknolojileri ve servisleri kullanmaktayız. Kişisel bilgilerinizi ve kredi kartı bilgilerinizi girdiğiniz sayfalarda tarayıcınızda bir kilit işareti çıkmaktadır. Bu işaret sitemizde işlem yaptığınız hiçbir bilginin üçüncü şahıslarca görüntülenemeyeceğinin ve erişilemeyeceğinin garantisidir. Sitemizde kredi kartı bilgileriniz kaydedilmez ve saklanmaz. Sitemizde yaptığınız her ödemede kart bilgilerinizi tekrar girmenizin nedeni budur.

3D SECURE

3D Secure sanal ortamda yapılan ticari işlemlerin güvenliğini sağlamak için geliştirilmiş bir kimlik doğrulama sistemidir. İnternetten yapılan kredi kartlı ödemelerde şifreyle onaylama işlemi olarak ta bilinir. Visa kredi kartları için yapılan uygulamaya "Verified by Visa", MasterCard için olanına ise "SecureCode" adı verilir.

3D Secure yöntemiyle yapılan ödemelerin tamamlanabilmesi için kart sahibinin işlem esnasında kendi özel şifresiyle işlem yapması zorunludur. Sitemizde yapacağınız ödemelerde kredi kartınızın bankasının 3D Secure sistemini desteklemesi durumunda ödemenizi 3D Secure yöntemiyle gerçekleştirebilirsiniz.`;

/** Tahsilat Sözleşmesi şablonu — şirket + müşteri değişkenleri */
export const TAHSILAT_TEMPLATE = `TAHSİLAT SÖZLEŞMESİ

#unvan# - ELEKTRONİK POS TAHSİLAT SÖZLEŞMESİ

MADDE 1. TARAFLAR VE KONU

İşbu sözleşme #webSitesi# internet sitesinden (bundan sonra İNTERNET SİTESİ olarak anılacaktır) sanal-elektronik pos vasıtasıyla ÜRÜN VE HİZMET (bundan sonra ÖDEME olarak anılacaktır) ödemeyi yapacak kişi / kurum ve firma (bundan sonra MÜŞTERİ olarak anılacaktır) ile #unvan# - #adres# adresinde #eposta# bulunan #unvan# (bundan sonra SATICI / HİZMET SAĞLAYICI olarak anılacaktır) arasındaki tahsilat işlemlerine ilişkin olarak, MÜŞTERİ tarafından elektronik ortamda doldurulan, ÖDEME işlemleri ile ilgili özelliklerin, nitelik-niceliğinin, ÜRÜN VE HİZMET bedellerinin tahsilat usül-şartlarının ve ÖDEME işlem tarihinin belirtildiği tahsilat formu ile Tüketicilerin Korunması Hakkındaki Kanun ve Mesafeli Sözleşmeler Uygulama Esas ve Usulleri Hakkında Yönetmelik hükümleri kapsamında tarafların hak, hukuk ve yükümlülüklerini tespit eder. ÖDEME işlemlerine konu bedeller #unvan# faaliyet konusunda yer alan ve faturasını kestiği ÜRÜN VE HİZMETLERDEN oluşmaktadır.

MADDE 2. CAYMA HAKKI

MÜŞTERİ; İşbu sözleşme tarihi itibariyle sanal-elektronik ortamda ve Madde 1’de sayılı gerekçelerle ve muaccel borcu bulunması şartıyla SATICI / HİZMET SAĞLAYICI’ya yapacağı ÜRÜN VE HİZMET kaynaklı her bir borç ÖDEME işlemi için, SATICI / HİZMET SAĞLAYICI’nın internet sitesinde yer alan kayıtlı hesaplarına yollanmış olması kaydıyla, yapılan ÖDEME’den hiçbir biçimde caymayacağını ve yapılan ÖDEME’nin hukuki ve cezai sorumluluğunu bildiğini kabul, beyan ve taahhüt eder. Aynı şekilde SATICI / HİZMET SAĞLAYICI de sanal-elektronik ortamda ve kendi internet sitesi aracılığıyla yapılan herhangi bir sehven sanal pos ödemesinin Madde 1 kapsamında yer alan ÜRÜN VE HİZMETİ bedeli olmadığını tespit etmesi halinde söz konusu ÖDEME’yi MÜŞTERİ hesabına / kartına iade edeceğini ve işlemi iptal ettireceğini kabul, beyan ve taahhüt eder.

MADDE 3. DİĞER HÜKÜMLER

3.1. MÜŞTERİ, İNTERNET SİTESİ'nde belirtilen ürün ve hizmetlerin temel nitelikleri, maliyet oluşumu ve ÖDEME şekline ilişkin bilgileri okuyup bilgi sahibi olduğunu ve elektronik ortamda ÖDEME için gerekli teyidi verdiğini kabul, beyan ve taahhüt eder.

3.2. İNTERNET SİTESİ'nden yapılan her bir ÖDEME sırasında MÜŞTERİ tarafından daha önce imzalanmış ve onaylanmış olan işbu Sözleşme ve şartları geçerli olacaktır.

3.3. MÜŞTERİ, ÖDEME’ye aracılık eden elektronik sistem lisans sahibine ya da MÜŞTERİ’ye atfedilemeyecek herhangi bir nedenle sanal-elektronik ortamı gerekçe göstererek uğradığını iddia ettiği bir zararın MÜŞTERİ tarafından tazminini isteyemeyeceğini bildiğini kabul, beyan ve taahhüt eder.

3.4. SATICI / HİZMET SAĞLAYICI; MÜŞTERİ sehven borçlu olduğu tutardan fazla bir ÖDEME yapması halinde, ÜRÜN VE HİZMET borcu bulunmaması kaydıyla, yapılan fazla ÖDEME’yi MÜŞTERİ’ye iade edeceğini ve işlemi iptal ettireceğini kabul, beyan ve taahhüt eder.

3.5. Tereddüte mahal vermemek bakımından; Bankalar ve finansman kuruluşları gibi kredi kartı, taksit kart v.b. veren kuruluşlarca sağlanan vadeli / taksitli ödeme imkanları bir kredi ve/veya doğrudan anılan kuruluşca sağlanmış taksitli ödeme imkanıdır; bu çerçevede MÜŞTERİ’nin herhangi bir gerçek ya da tüzel kişiliği olmayışı ve ticari bir faaliyette bulunması yasak oluşu gerekçeleriyle sanal-elektronik ortamda MÜŞTERİ tarafından yapılacak tüm ÖDEME’lerin peşin ÖDEME olacağı ya da sayılacağını Taraflar kabul, beyan ve taahhüt ederler.

3.6. Olağanüstü durumlar ya da mücbir sebepler (hava muhalefeti, deprem, sel, yangın gibi) nedeni ile sanal-elektronik pos sisteminde arıza oluşması halinde MÜŞTERİ; arıza giderilinceye dek muaccel hale gelmiş Madde 1 kapsamındaki ÜRÜN VE HİZMET borçlarını diğer ödeme yöntem ve araçları ile ödeyeceğini kabul, beyan ve taahhüt eder.

3.7. MÜŞTERİ; ÖDEME sistemine dair talep ve şikayetlerini SATICI / HİZMET SAĞLAYICI adresine yazılı olarak bildirebilir.

MADDE 4. SÖZLEŞMENİN FESHİ

İşbu sözleşme Taraflar’dan herhangi biri tarafından gerekçe göstermeksizin fesih tarihinden 1 ay önce yapılacak yazılı fesih bildirimine müteakip feshedilebilir.

MADDE 5. DELİL ANLAŞMASI VE YETKİLİ MAHKEME

Bu Sözleşme'den ve/veya uygulanmasından doğabilecek her türlü uyuşmazlığın çözümünde SATICI / HİZMET SAĞLAYICI kayıtları (bilgisayar-ses kayıtları gibi manyetik ortamdaki kayıtlar dahil) kesin delil oluşturur; hukuki ihtilafların çözümünde SATICI / HİZMET SAĞLAYICI’in yerleşim yerindeki Mahkemeler ve İcra Müdürlükleri yetkilidir.

MÜŞTERİ bu Sözleşmede yazılı tüm koşulları ve açıklamaları okuduğunu, ÖDEME koşullarının ve sair tüm ön bilgileri aldığını, incelediğini ve tamamını kabul ettiğini beyan, kabul ve taahhüt eder.

#musteriUnvanAdSoyad#
Vergi & TC No : #musteriVergiTCPassPortNo#
Adres : #musteriAdres#
Telefon : +90 #musteriTelefon# E-Posta : #musteriEposta#`;

/** İptal ve İade Politikası şablonu */
export const IPTAL_IADE_TEMPLATE = `İPTAL, İADE VEYA KISMİ İADE ŞARTLARI

Online tahsilat sisteminden 3D veya Sanal POS ile yapılan tahsilatlarda itiraz süreci 7 iş günüdür. Kart sahibinin tarafımıza iade talebinde bulunması durumunda; 7 iş günü içerisinde gerekli kontroller yapılıp müşteriye bilgi verilecek ve karşılıklı uzlaşma sonucu İptal, İade veya Kısmi İade işlemi yapılacaktır.

KİŞİSEL BİLGİ GÜVENLİĞİ

#webSitesi# müşterilerinden, üyelik ve ödeme sırasında alınan tüm kişisel bilgiler mevcut en yüksek elektronik ve fiziksel güvenlik sistemleriyle korunmakta, sadece yetki sahibi personel ve gerekli durumlarda kullanıcı onayı ile görüntülenebilecek bir ortamda saklanmaktadır. Bu bilgiler yalnızca Türkiye Cumhuriyeti Kanunları ve Uluslararası Kanunlar çerçevesinde kullanılmaktadır. Kişisel bilgilerin kullanıcı onayı olmaksızın hiçbir şekilde açıklanmaması, yayınlanmaması, üçüncü şahıslarla paylaşılmaması firmamız tarafından taahhüt ve garanti edilmiştir. #webSitesi# kişisel bilgilerin dışındaki genel kullanıcı bilgilerini, kullanıcı onayı verildiği takdirde; bilgilendirme, tanıtım, duyuru ve teklif amacıyla kullanma haklarını saklı tutar.

ÖDEME BİLGİLERİ GÜVENLİĞİ

#webSitesi# bünyesinde oluşturulmuş olan online güvenlik departmanı; ilk kez ödeme yapacak olan müşterilerimizin kimlik ve adres bilgilerinin kontrolünü yaparak, gerekli durumlarda müşterilerle telefonla irtibata geçerek kredi kartı sahtekarlığı gibi yasal olmayan kullanımları önlemek için önlem almaktadır. #webSitesi# 2048bit güvenlik sertifikasına sahiptir. #webSitesi# den yapılan ödemelerde verilen kredi kartı bilgileri siteden bağımsız olarak TrustSafe tarafından sağlanan 2048bit SSL Şifreleme Protokolü kullanılarak anlaşmalı bankaların sistemine aktarılır ve banka tarafından sorgulama işlemi yapılır. Sorgulama sonucu anında müşteriye iletilir ve 3D Secure ile ödeme işlemi tamamlanır. Girilmiş olan kart bilgileri direk olarak bankaya iletilmekte; tüm işlemler müşteri ve banka arasında gerçekleşmektedir. Bu bilgiler hiçbir şekilde site tarafından görüntülenemediği ve kaydedilmediği için bilgilerin üçüncü şahısların eline geçmesi mümkün değildir. Ödeme sayfasının sol üst köşesinde bulunan kilit resmi sayfanın SSL ile şifrelenerek güvenlik altına alındığını göstermektedir.

GÜVENLİK UYARISI

Kredi kartı bilgilerinin çalınması gibi durumlar büyük çoğunlukla fiziki ortamlarda gerçekleşmektedir. Bu nedenle restoran vb. yerlerde kredi kartlarının kullanılması veya kart numarasının başkalarına verilmesi tavsiye edilmemektedir. Kredi kartının çalınması, kaybolması veya izinsiz kullanıldığının fark edilmesi gibi durumlarda zaman kaybedilmeksizin kartın ait olduğu banka ile irtibata geçilmeli ve durum bildirilmelidir. #webSitesi# tarafından tespit edilen kredi kartı sahtekarlığı durumlarında ilgili banka ve kart sahibi durum hakkında bilgilendirilmektedir. İnternet üzerinden yapılan alışverişlerde, alışveriş yapılan sitenin adres ve telefon bilgilerinin doğruluğundan emin olunmalı, gerekirse sitedeki müşteri hizmetleri numarası aranarak doğrulama yapılmalıdır.

#webSitesi#

İş bu sözleşmeden doğabilecek tüm uyuşmazlıkların giderilmesinde ANTALYA mahkemeleri ve icra daireleri yetkilidir.`;

/** İletişim Bilgileri şablonu */
export const ILETISIM_TEMPLATE = `Ünvan : #unvan#
Adres : #adres#
Vergi Dairesi / No : #vergiDairesi# / #vergiTCNo#
Telefon : +90 #telefon#
Faks : +90 #fax#
GSM : +90 #gsm#
E-Posta : #eposta#
WEB : #webSitesi#`;

/**
 * Üyelik Sözleşmesi — site üyeliği hak/yükümlülükleri.
 * #unvan#, #webSitesi#, #eposta#, #adres# footer / ayarlarda çözülür.
 */
export const UYELIK_TEMPLATE = `ÜYELİK SÖZLEŞMESİ

#unvan# — #webSitesi#

MADDE 1. TARAFLAR VE KONU

İşbu Üyelik Sözleşmesi (“Sözleşme”), #webSitesi# internet sitesi ve buna bağlı mobil / dijital uygulamalar (bundan sonra birlikte “Platform” olarak anılacaktır) üzerinden sunulan üyelik, hesap oluşturma ve ilgili hizmetlerin kullanımına ilişkin şartları düzenler.

Taraflar; Platform’u işleten #unvan# (“Şirket”) ile Platform’a üye olan veya üyelik başvurusunda bulunan gerçek / tüzel kişi (“Üye”)dir. Üye, Platform’da üyelik oluşturarak, “Kabul ediyorum” benzeri onay vererek veya hizmetlerden yararlanmaya başlayarak işbu Sözleşme’nin tüm hükümlerini okuduğunu, anladığını ve kabul ettiğini beyan eder.

MADDE 2. TANIMLAR

Üyelik: Platform’da oluşturulan, Üye’ye özel hesap ve erişim yetkisidir.
Hesap Bilgileri: Üye’nin kayıt sırasında ve sonrasında paylaştığı kimlik, iletişim, vergi / TCKN ve benzeri bilgiler ile giriş bilgileri.
Hizmet: Platform üzerinden sunulan tahsilat, ödeme, raporlama, bildirim ve bağlı dijital hizmetlerdir.
İçerik: Platform’da yer alan metin, belge, görsel, yazılım ve diğer tüm materyallerdir.

MADDE 3. ÜYELİK KOŞULLARI

3.1. Üyelik için 18 yaşını doldurmuş olmak veya tüzel kişi adına işlem yapmaya yetkili olmak gerekir. Tüzel kişi adına kayıt yapan kişi, bu yetkiye sahip olduğunu kabul eder.
3.2. Üye, kayıt formunda istenen bilgileri eksiksiz, güncel ve doğru olarak vermekle yükümlüdür. Bilgilerde değişiklik olduğunda hesabını güncellemek Üye’nin sorumluluğundadır.
3.3. Şirket, başvuruyu kabul etme, ek belge / doğrulama isteme veya gerekçeli olarak reddetme hakkını saklı tutar.
3.4. Her Üye’nin tek bir hesabı olması esastır. Şirket, mükerrer veya kötüye kullanıma elverişli hesapları askıya alabilir veya kapatabilir.

MADDE 4. HESAP GÜVENLİĞİ

4.1. Kullanıcı adı, e-posta ve şifre yalnızca Üye’ye aittir; üçüncü kişilerle paylaşılmamalıdır.
4.2. Hesap üzerinden yapılan işlemlerin hukuki sonuçlarından Üye sorumludur.
4.3. Şifrenin veya hesabın yetkisiz kullanıldığından şüphe edilmesi halinde Üye, durumu derhal Şirket’e bildirmeyi kabul eder.
4.4. Şirket, hesap güvenliğini artırmak için ek doğrulama (SMS, e-posta, 2FA vb.) talep edebilir.

MADDE 5. ÜYENİN HAK VE YÜKÜMLÜLÜKLERİ

5.1. Üye, Platform’u yalnızca hukuka, bu Sözleşme’ye ve ilgili diğer politikalara (KVKK, Hizmet, Tahsilat vb.) uygun kullanır.
5.2. Üye; sahte kimlik, yanıltıcı bilgi, yetkisiz erişim, sisteme zarar verme, spam, dolandırıcılık veya üçüncü kişilerin haklarını ihlal eden davranışlarda bulunamaz.
5.3. Üye, Platform üzerinden gerçekleştirdiği tahsilat / ödeme işlemlerinin kendi ticari veya hukuki ilişkisinden kaynaklandığını; işlem tutarı, açıklama ve karşı taraf bilgilerinin doğruluğundan sorumlu olduğunu kabul eder.
5.4. Üye, Platform’un teknik altyapısına, güvenliğine veya bütünlüğüne zarar verecek girişimlerde bulunamaz.

MADDE 6. ŞİRKETİN HAK VE YÜKÜMLÜLÜKLERİ

6.1. Şirket, Platform’u makul özenle işletmeyi ve hizmet sürekliliğini sağlamayı hedefler; ancak kesintisiz erişim taahhüdü vermez.
6.2. Şirket; bakım, güncelleme, güvenlik, yasal zorunluluk veya mücbir sebep nedeniyle hizmeti geçici olarak durdurabilir veya değiştirebilir.
6.3. Şirket, işbu Sözleşme’yi ve Platform kurallarını önceden duyurarak güncelleyebilir. Güncelleme sonrası Platform’un kullanılmaya devam edilmesi yeni şartların kabulü anlamına gelir.
6.4. Şirket, kötüye kullanım, güvenlik riski veya yasal zorunluluk halinde Üye hesabını sınırlayabilir, askıya alabilir veya sonlandırabilir.

MADDE 7. KİŞİSEL VERİLER VE GİZLİLİK

Üye’ye ait kişisel veriler, 6698 sayılı Kişisel Verilerin Korunması Kanunu ve Platform’da yayımlanan KVKK / Aydınlatma Metni kapsamında işlenir. Detaylı bilgilendirme için ilgili metin geçerlidir.

MADDE 8. FİKRİ MÜLKİYET

Platform’daki tüm yazılım, tasarım, marka, logo, metin ve diğer içerikler Şirket’e veya lisans verenlere aittir. Üye’ye yalnızca kişisel / kurumsal kullanım için sınırlı, devredilemez bir kullanım hakkı tanınır; kopyalama, tersine mühendislik, ticari çoğaltma veya izinsiz dağıtım yasaktır.

MADDE 9. ÜYELİĞİN SONA ERMESİ

9.1. Üye, hesabını kapatma talebiyle üyelikten ayrılabilir.
9.2. Şirket; Sözleşme ihlali, yasal zorunluluk, güvenlik gerekçesi veya uzun süreli hareketsizlik halinde üyeliği sona erdirebilir.
9.3. Üyeliğin sona ermesi, sona erme öncesinde doğmuş borç, tahsilat ve yasal yükümlülükleri ortadan kaldırmaz.

MADDE 10. SORUMLULUĞUN SINIRI

Platform ve hizmetler “olduğu gibi” sunulur. Şirket; dolaylı zararlar, kâr kaybı, veri kaybı veya Üye’nin kendi cihaz / bağlantı sorunlarından kaynaklanan sonuçlardan, kanunen zorunlu haller dışında sorumlu tutulamaz. Ödeme altyapısı, banka ve üçüncü taraf sağlayıcı kaynaklı gecikme veya kesintilerden Şirket’in kusuru bulunmadığı ölçüde sorumluluk kabul edilmez.

MADDE 11. UYGULANACAK HUKUK VE YETKİ

İşbu Sözleşme Türkiye Cumhuriyeti hukukuna tabidir. Uyuşmazlıklarda Şirket’in yerleşim yeri mahkemeleri ve icra daireleri yetkilidir; tüketici işlemlerinde ilgili zorunlu yetki kuralları saklıdır.

MADDE 12. İLETİŞİM

Üyelik, hesap ve Sözleşme ile ilgili bildirimler için:

#unvan#
Adres : #adres#
E-Posta : #eposta#
WEB : #webSitesi#

Üye, Platform’a kayıt olurken veya hizmetleri kullanırken işbu Üyelik Sözleşmesi’nin tamamını okuduğunu, anladığını ve kabul ettiğini beyan, kabul ve taahhüt eder.`;

const SEED_BODIES: Partial<Record<ContractLinkId, string>> = {
  kvkk: KVKK_TEMPLATE,
  hizmet: HIZMET_TEMPLATE,
  guvenlik: GUVENLIK_TEMPLATE,
  tahsilat: TAHSILAT_TEMPLATE,
  'iptal-iade': IPTAL_IADE_TEMPLATE,
  iletisim: ILETISIM_TEMPLATE,
  uyelik: UYELIK_TEMPLATE,
};

function seed(): ContractDef[] {
  const links: ContractLinkId[] = [
    'kvkk',
    'hizmet',
    'guvenlik',
    'tahsilat',
    'iptal-iade',
    'iletisim',
    'uyelik',
  ];
  return links.map((link, i) => {
    const label = CONTRACT_LINK_OPTIONS.find((x) => x.id === link)?.label ?? link;
    return {
      id: `c-${link}`,
      name: label,
      body: SEED_BODIES[link] ?? '',
      link,
      order: i,
    };
  });
}

/** Eski boş seed kayıtlarına bilinen şablonları doldur */
function fillMissingSeedBodies(list: ContractDef[]): ContractDef[] {
  let changed = false;
  const next = list.map((c) => {
    const seedBody = SEED_BODIES[c.link];
    if (!seedBody || c.body.trim()) return c;
    changed = true;
    return { ...c, body: seedBody };
  });
  return changed ? next : list;
}

export function loadContracts(): ContractDef[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      const s = seed();
      localStorage.setItem(LS_KEY, JSON.stringify(s));
      return s.map((x) => ({ ...x }));
    }
    const parsed = JSON.parse(raw) as ContractDef[];
    if (!Array.isArray(parsed) || !parsed.length) return seed();
    const normalized = parsed
      .filter((x) => x && typeof x.id === 'string' && typeof x.name === 'string')
      .map((x, i) => ({
        id: x.id,
        name: x.name,
        body: typeof x.body === 'string' ? x.body : '',
        link: (CONTRACT_LINK_OPTIONS.some((o) => o.id === x.link) ? x.link : 'none') as ContractLinkId,
        order: typeof x.order === 'number' ? x.order : i,
      }))
      .sort((a, b) => a.order - b.order);
    const filled = fillMissingSeedBodies(normalized);
    if (filled !== normalized) localStorage.setItem(LS_KEY, JSON.stringify(filled));
    return filled;
  } catch {
    return seed();
  }
}

export function saveContracts(list: ContractDef[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

export function getContractByLink(link: Exclude<ContractLinkId, 'none'>): ContractDef | null {
  return loadContracts().find((c) => c.link === link) ?? null;
}

export function resolveContractVars(text: string, vars: ContractVarMap): string {
  return text.replace(/#([a-zA-ZğüşıöçĞÜŞİÖÇ0-9_]+)#/g, (_, key: string) => {
    const v = vars[key];
    return v != null && v !== '' ? v : `#${key}#`;
  });
}

/** Footer için şirket değişkenleri (iletişim ayarlarından) */
export function getCompanyContractVars(): ContractVarMap {
  try {
    const raw = localStorage.getItem('anypay.contactSettings.v1');
    const c = raw ? (JSON.parse(raw) as Record<string, string>) : null;
    const title = c?.title || 'GÜZEL İÇ VE DIŞ TİCARET LİMİTED ŞİRKETİ';
    const address = c?.address || 'Yeni Emek Mah. Yıldırım Beyazıt Cad. No:130A Kepez / Antalya / Türkiye';
    const email = c?.email || 'bilgi@guzelteknoloji.com';
    const phoneRaw = (c?.phone || '8508851160').replace(/\D/g, '');
    const phone =
      phoneRaw.length === 10
        ? `${phoneRaw.slice(0, 3)} ${phoneRaw.slice(3, 6)} ${phoneRaw.slice(6, 8)} ${phoneRaw.slice(8)}`
        : phoneRaw || '850 885 11 60';
    const gsmRaw = (c?.gsm || '5438851160').replace(/\D/g, '');
    const gsm =
      gsmRaw.length === 10
        ? `${gsmRaw.slice(0, 3)} ${gsmRaw.slice(3, 6)} ${gsmRaw.slice(6, 8)} ${gsmRaw.slice(8)}`
        : gsmRaw || '543 885 11 60';
    const faxRaw = (c?.fax || '8508851260').replace(/\D/g, '');
    const fax =
      faxRaw.length === 10
        ? `${faxRaw.slice(0, 3)} ${faxRaw.slice(3, 6)} ${faxRaw.slice(6, 8)} ${faxRaw.slice(8)}`
        : faxRaw || '850 885 12 60';
    return {
      webSitesi: 'https://tahsilat.guzelteknoloji.com',
      unvan: title,
      vergiTCNo: c?.taxNo || '9250508945',
      vergiDairesi: c?.taxOffice || 'Ankara Kurumlar V.D.',
      adres: address,
      eposta: email,
      telefon: phone,
      gsm,
      fax,
    };
  } catch {
    return {
      webSitesi: 'https://tahsilat.guzelteknoloji.com',
      unvan: 'GÜZEL İÇ VE DIŞ TİCARET LİMİTED ŞİRKETİ',
      vergiTCNo: '9250508945',
      vergiDairesi: 'Ankara Kurumlar V.D.',
      adres: 'Yeni Emek Mah. Yıldırım Beyazıt Cad. No:130A Kepez / Antalya / Türkiye',
      eposta: 'bilgi@guzelteknoloji.com',
      telefon: '850 885 11 60',
      gsm: '543 885 11 60',
      fax: '850 885 12 60',
    };
  }
}
