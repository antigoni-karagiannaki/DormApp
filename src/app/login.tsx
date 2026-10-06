import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput } from "react-native";
import { supabase } from "../../lib/supabase";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";

export default function Login() {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert("Missing information", "Please enter email and password.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

    setLoading(false);
 
    console.log("LOGIN DATA:", data);
    console.log("LOGIN ERROR:", error);
 
    if (error) {
      Alert.alert("Login failed", error.message);
      return;
    }
  
    if (!data.session) {
      Alert.alert(
        "Login problem",
        "Supabase accepted the login but no session was returned."
      );
      return;
    }
 
    Alert.alert(
      "Login successful",
      `Logged in as ${data.user.email}`
    );
  
    router.replace("/home");
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Welcome Back</ThemedText>

      <TextInput
        style={[styles.input, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, color: theme.text }]}
        placeholder="Email"
        placeholderTextColor={theme.textSecondary}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={[styles.input, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, color: theme.text }]}
        placeholder="Password"
        placeholderTextColor={theme.textSecondary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Pressable
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Logging in..." : "Log In"}
        </Text>
      </Pressable>

      <Pressable onPress={() => router.push("/signup")}>
        <ThemedText style={[styles.link, { color: theme.accent }]}>Don't have an account? Create one</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 30,
  },
  title: {
    fontSize: 30,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#1e40af",
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 16,
  },
  link: {
    textAlign: "center",
    color: "#1e40af",
  },
});