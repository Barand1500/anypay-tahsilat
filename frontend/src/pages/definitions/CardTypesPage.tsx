import { CardListPage } from './CardListPage';

export default function CardTypesPage() {
  return (
    <CardListPage
      title="Kart Tipleri"
      titleCreate="Kart Tipi Ekle"
      titleEdit="Kart Tipi Düzenle"
      filename="kart-tipleri.csv"
      apiPath="/api/card-types"
      deleteTitle="Kart tipini sil"
    />
  );
}
