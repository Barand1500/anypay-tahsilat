import { CardListPage } from './CardListPage';
import { INITIAL_CARD_KINDS } from './mockKart';

export default function CardKindsPage() {
  return (
    <CardListPage
      title="Kart Türleri"
      titleCreate="Kart Türü Ekle"
      titleEdit="Kart Türü Düzenle"
      filename="kart-turleri.csv"
      initial={INITIAL_CARD_KINDS}
      deleteTitle="Kart türünü sil"
    />
  );
}
