import { FlatList, Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { useLibrary } from "@/lib/library-store";
import { confirm } from "@/lib/dialogs";

export default function MovementsScreen() {
  const { books, loans, returnBook } = useLibrary();
  const activeLoans = loans.filter((loan) => !loan.returnedAt);
  function returnLoan(id: string, title: string) { confirm("Confirmar devolução", `Registrar a devolução de “${title}”?`, () => returnBook(id), "Devolver"); }
  return (
    <ScreenContainer containerClassName="bg-[#F4F2EA]">
      <FlatList
        data={activeLoans}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 36 }}
        ListHeaderComponent={<View><Text className="text-3xl font-bold text-[#163A2B]">Movimentações</Text><Text className="text-[#6B7C70] mt-1 mb-6">Acompanhe empréstimos e devoluções</Text><View className="bg-[#163A2B] rounded-3xl p-5 mb-6"><View className="flex-row items-center justify-between"><View><Text className="text-[#CFE6D7] text-xs font-bold tracking-widest">EMPRÉSTIMOS ATIVOS</Text><Text className="text-white text-4xl font-bold mt-2">{activeLoans.length}</Text></View><View className="w-12 h-12 rounded-2xl bg-[#315843] items-center justify-center"><MaterialIcons name="sync-alt" size={24} color="#CFE6D7" /></View></View><Text className="text-[#CFE6D7] text-sm mt-3">Lembretes de devolução ajudam o acervo a circular.</Text></View><Text className="text-[#294B39] font-bold text-base mb-3">Em andamento</Text></View>}
        renderItem={({ item }) => { const book = books.find((candidate) => candidate.id === item.bookId); if (!book) return null; return <View className="bg-white rounded-3xl p-4 mb-3 border border-[#E2E7E1]"><View className="flex-row items-start"><View className="w-11 h-14 rounded-xl bg-[#E2EBDD] items-center justify-center mr-3"><MaterialIcons name="menu-book" size={22} color="#52705D" /></View><View className="flex-1"><Text className="text-[#163A2B] font-bold" numberOfLines={2}>{book.title}</Text><Text className="text-[#6B7C70] text-sm mt-1">{item.borrower}</Text><Text className="text-[#A47839] text-xs font-bold mt-2">Devolver {item.dueAt}</Text></View></View><Pressable onPress={() => returnLoan(item.id, book.title)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]} className="bg-[#E6F0E8] rounded-2xl py-3 items-center mt-4"><Text className="text-[#315843] font-bold text-sm">Registrar devolução</Text></Pressable></View>; }}
        ListEmptyComponent={<View className="bg-white rounded-3xl p-7 items-center mt-2"><MaterialIcons name="check-circle" size={42} color="#67A67B" /><Text className="text-[#163A2B] font-bold mt-3">Tudo em dia</Text><Text className="text-[#6B7C70] text-center text-sm mt-1">Não há empréstimos ativos no momento.</Text></View>}
      />
    </ScreenContainer>
  );
}
