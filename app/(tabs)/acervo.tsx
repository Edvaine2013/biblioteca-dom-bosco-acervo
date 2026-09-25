import { useMemo, useState } from "react";
import { FlatList, Image, Modal, Pressable, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { getInitials, useLibrary, type Book } from "@/lib/library-store";
import { confirm } from "@/lib/dialogs";

const green = "#163A2B";

export default function AcervoScreen() {
  const router = useRouter();
  const { books, loans, borrowBook, deleteBook } = useLibrary();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"todos" | "disponiveis">("todos");
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const filtered = useMemo(() => books.filter((book) => `${book.title} ${book.author} ${book.category}`.toLowerCase().includes(query.toLowerCase()) && (filter === "todos" || book.available)), [books, filter, query]);

  function loan(book: Book) {
    confirm("Registrar empréstimo", `Confirmar empréstimo de “${book.title}”?`, () => borrowBook(book.id, "Leitor atual"));
  }
  async function confirmDelete() {
    if (!bookToDelete) return;
    setIsDeleting(true);
    try {
      await deleteBook(bookToDelete.id);
      setBookToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <ScreenContainer containerClassName="bg-[#F4F2EA]">
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 36 }}
        ListHeaderComponent={
          <View>
            <View className="flex-row items-start justify-between mb-5">
              <View><Text className="text-3xl font-bold text-[#163A2B]">Acervo</Text><Text className="text-[#6B7C70] mt-1">{books.length} livros catalogados</Text></View>
              <Pressable onPress={() => router.push("/novo-livro" as any)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]} className="w-11 h-11 rounded-2xl bg-[#163A2B] items-center justify-center"><MaterialIcons name="add" size={24} color="white" /></Pressable>
            </View>
            <View className="flex-row items-center bg-white rounded-2xl px-4 mb-4 border border-[#E0E5DF]"><MaterialIcons name="search" size={21} color="#7D8C82" /><TextInput value={query} onChangeText={setQuery} placeholder="Buscar por título ou autor" placeholderTextColor="#9AA69D" className="flex-1 py-3.5 px-3 text-[#163A2B]" /></View>
            <View className="flex-row gap-2 mb-5"><Chip label="Todos" active={filter === "todos"} onPress={() => setFilter("todos")} /><Chip label="Disponíveis" active={filter === "disponiveis"} onPress={() => setFilter("disponiveis")} /></View>
          </View>
        }
        renderItem={({ item }) => <BookCard book={item} onLoan={() => loan(item)} onDelete={() => setBookToDelete(item)} />}
        ListEmptyComponent={<View className="items-center py-16"><MaterialIcons name="menu-book" size={42} color="#A9B9AD" /><Text className="text-[#6B7C70] mt-3">Nenhum livro encontrado.</Text></View>}
      />
      <Modal visible={Boolean(bookToDelete)} transparent animationType="fade" onRequestClose={() => setBookToDelete(null)}>
        <View className="flex-1 bg-black/40 items-center justify-center px-6">
          <View className="w-full max-w-md bg-white rounded-3xl p-6">
            <View className="w-12 h-12 rounded-2xl bg-[#FBE5E2] items-center justify-center"><MaterialIcons name="delete-outline" size={25} color="#A83D32" /></View>
            <Text className="text-[#163A2B] text-xl font-bold mt-4">Excluir livro do acervo?</Text>
            <Text className="text-[#6B7C70] leading-5 mt-2">“{bookToDelete?.title}” e suas movimentações serão removidos deste dispositivo.</Text>
            {bookToDelete && loans.some((loan) => loan.bookId === bookToDelete.id && !loan.returnedAt) && <Text className="text-[#A86428] text-sm font-bold mt-3">Este livro possui um empréstimo ativo.</Text>}
            <View className="flex-row gap-3 mt-6"><Pressable disabled={isDeleting} onPress={() => setBookToDelete(null)} className="flex-1 bg-[#E8EDE9] rounded-2xl py-3.5 items-center"><Text className="text-[#315843] font-bold">Cancelar</Text></Pressable><Pressable disabled={isDeleting} onPress={confirmDelete} className="flex-1 bg-[#A83D32] rounded-2xl py-3.5 items-center"><Text className="text-white font-bold">{isDeleting ? "Excluindo..." : "Excluir"}</Text></Pressable></View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]} className={`rounded-full px-4 py-2 ${active ? "bg-[#163A2B]" : "bg-[#E4EBE5]"}`}><Text className={`text-xs font-bold ${active ? "text-white" : "text-[#597061]"}`}>{label}</Text></Pressable>;
}

function BookCard({ book, onLoan, onDelete }: { book: Book; onLoan: () => void; onDelete: () => void }) {
  const details = [book.publisher, book.edition ? `${book.edition} ed.` : undefined, book.year !== "—" ? book.year : undefined, book.pages ? `${book.pages} p.` : undefined].filter(Boolean).join(" · ");
  return <View className="bg-white rounded-3xl p-4 mb-3 border border-[#E2E7E1]"><View className="flex-row">{book.coverUri ? <Image source={{ uri: book.coverUri }} className="w-16 h-20 rounded-2xl bg-[#D9E9DD] mr-3" resizeMode="cover" accessibilityLabel={`Capa de ${book.title}`} /> : <View className="w-16 h-20 rounded-2xl bg-[#D9E9DD] items-center justify-center mr-3"><Text className="text-[#163A2B] text-xl font-bold">{getInitials(book.title)}</Text></View>}<View className="flex-1"><Text className="text-[#163A2B] font-bold text-base" numberOfLines={2}>{book.title}</Text>{book.subtitle ? <Text className="text-[#6B7C70] text-xs mt-0.5" numberOfLines={1}>{book.subtitle}</Text> : null}<Text className="text-[#6B7C70] text-sm mt-1" numberOfLines={1}>{book.author}</Text>{details ? <Text className="text-[#7D8C82] text-xs mt-1" numberOfLines={1}>{details}</Text> : null}<Text className="text-[#91A197] text-xs mt-1">{book.category} · {book.shelf}{book.isbn ? ` · ISBN ${book.isbn}` : ""}</Text></View><Pressable onPress={onDelete} accessibilityLabel={`Excluir ${book.title}`} className="w-9 h-9 rounded-xl bg-[#FBEAE7] items-center justify-center ml-2"><MaterialIcons name="delete-outline" size={19} color="#A83D32" /></Pressable></View><View className="flex-row justify-between items-center mt-4 pt-3 border-t border-[#EEF1ED]"><Text className={`text-xs font-bold ${book.available ? "text-[#4A8B61]" : "text-[#B5792C]"}`}>{book.available ? "Disponível" : "Emprestado"}</Text>{book.available && <Pressable onPress={onLoan} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}><Text className="text-[#163A2B] text-xs font-bold">Registrar empréstimo →</Text></Pressable>}</View></View>;
}
