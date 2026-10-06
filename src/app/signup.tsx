import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput } from "react-native";
import { supabase } from "../../lib/supabase";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";

export default function SignUp() {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    if (!email || !password) {
      Alert.alert("Missing information", "Please enter email and password.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        Alert.alert("Sign up failed", error.message);
        return;
      }

      if (!data.session) {
        Alert.alert(
          "Check your email",
          "Confirm your email address before logging in."
        );
        return;
      }

      router.replace("/home");
    } catch (error) {
      Alert.alert(
        "Sign up failed",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Create Account</ThemedText>

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
        onPress={handleSignUp}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Creating..." : "Create Account"}
        </Text>
      </Pressable>

      <Pressable onPress={() => router.replace("/login")}>
        <ThemedText style={[styles.link, { color: theme.accent }]}>Already have an account? Log in</ThemedText>
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