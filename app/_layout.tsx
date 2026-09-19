import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { createTRPCClient, trpc } from "@/lib/trpc";
import { LibraryProvider } from "@/lib/library-store";
import { useState } from "react";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => createTRPCClient());
  return <trpc.Provider client={trpcClient} queryClient={queryClient}><QueryClientProvider client={queryClient}><ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}><LibraryProvider><Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(tabs)" /><Stack.Screen name="novo-livro" options={{ presentation: "card" }} /><Stack.Screen name="oauth/callback" /></Stack><StatusBar style={colorScheme === "dark" ? "light" : "dark"} /></LibraryProvider></ThemeProvider></QueryClientProvider></trpc.Provider>;
}
