import { CardListPage } from './CardListPage';
import { INITIAL_CARD_TYPES } from './mockKart';

export default function CardTypesPage() {
  return (
    <CardListPage
      title="Kart Tipleri"
      titleCreate="Kart Tipi Ekle"
      titleEdit="Kart Tipi Düzenle"
      filename="kart-tipleri.csv"
      initial={INITIAL_CARD_TYPES}
      deleteTitle="Kart tipini sil"
    />
  );
}
