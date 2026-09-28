import { CardListPage } from './CardListPage';

export default function CardKindsPage() {
  return (
    <CardListPage
      title="Kart Türleri"
      titleCreate="Kart Türü Ekle"
      titleEdit="Kart Türü Düzenle"
      filename="kart-turleri.csv"
      apiPath="/api/card-kinds"
      deleteTitle="Kart türünü sil"
    />
  );
}
