import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "../../lib/supabase";

type House = {
  id: string;
  name: string | null;
  washing_machine_available: boolean;
  shower_available: boolean;
};

type Resident = {
  id: string;
  name: string;
  room: string;
};

export default function Home() {
  const theme = useTheme();
  const [house, setHouse] = useState<House | null>(null);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadHouse() {
      setLoading(true);
      setError("");

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userData.user) {
          router.replace("/login");
          return;
        }

        const { data: membership, error: membershipError } = await supabase
          .from("house_members")
          .select("house_id")
          .eq("profile_id", userData.user.id)
          .limit(1)
          .maybeSingle();
        if (membershipError) throw membershipError;

        if (!membership) {
          if (active) {
            setHouse(null);
            setResidents([]);
          }
          return;
        }

        const { data: houseData, error: houseError } = await supabase
          .from("houses")
          .select("id, name, washing_machine_available, shower_available")
          .eq("id", membership.house_id)
          .single();
        if (houseError) throw houseError;

        const { data: memberData, error: memberError } = await supabase
          .from("house_members")
          .select("profile_id, floor, room")
          .eq("house_id", membership.house_id);
        if (memberError) throw memberError;

        const profileIds = [...new Set((memberData ?? []).map((member) => member.profile_id))];
        const { data: profileData, error: profileError } = profileIds.length
          ? await supabase.from("profiles").select("id, name").in("id", profileIds)
          : { data: [], error: null };
        if (profileError) throw profileError;

        const names = new Map(
          (profileData ?? []).map((profile) => [profile.id, profile.name ?? "Resident"])
        );

        if (active) {
          setHouse(houseData as House);
          setResidents(
            (memberData ?? []).map((member) => ({
              id: member.profile_id,
              name: names.get(member.profile_id) ?? "Resident",
              room: [member.floor, member.room].filter(Boolean).join(" · "),
            }))
          );
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load your house.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadHouse();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  async function handleJoinHouse() {
    const code = joinCode.trim();
    if (!code) {
      setError("Enter the join ID for your house.");
      return;
    }

    setJoining(true);
    setError("");

    try {
      const { error: joinError } = await supabase.rpc("join_house_by_code", {
        p_join_code: code,
      });
      if (joinError) throw joinError;

      setJoinCode("");
      setRefreshKey((value) => value + 1);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Could not join that house.");
    } finally {
      setJoining(false);
    }
  }

  async function handleLogout() {
    const { error: logoutError } = await supabase.auth.signOut();
    if (logoutError) {
      setError(logoutError.message);
      return;
    }
    router.replace("/login");
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <ThemedText style={styles.pageTitle}>🏠 Our House</ThemedText>
          <Pressable accessibilityRole="button" onPress={handleLogout}>
            <ThemedText style={[styles.link, { color: theme.accent }]}>Log out</ThemedText>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.accent} style={styles.loader} />
        ) : house ? (
          <>
            <ThemedText style={styles.houseName}>{house.name || "Your house"}</ThemedText>

            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>👥 Residents</ThemedText>
              {residents.length ? (
                residents.map((resident, index) => (
                  <View
                    key={resident.id}
                    style={[
                      styles.residentRow,
                      index > 0 && { borderTopColor: theme.backgroundSelected, borderTopWidth: 1 },
                    ]}
                  >
                    <ThemedText>{resident.name}</ThemedText>
                    {resident.room ? (
                      <ThemedText style={[styles.secondaryText, { color: theme.textSecondary }]}>
                        {resident.room}
                      </ThemedText>
                    ) : null}
                  </View>
                ))
              ) : (
                <ThemedText style={{ color: theme.textSecondary }}>No residents found.</ThemedText>
              )}
            </View>

            <View style={styles.resources}>
              <ResourceStatus
                title="🧺 Washing Machine"
                available={house.washing_machine_available}
                theme={theme}
              />
              <ResourceStatus title="🚿 Shower" available={house.shower_available} theme={theme} />
            </View>
          </>
        ) : (
          <View style={styles.joinSection}>
            <ThemedText style={styles.houseName}>Join your house</ThemedText>
            <ThemedText style={[styles.secondaryText, { color: theme.textSecondary }]}>
              Enter the join ID shared by a house resident.
            </ThemedText>
            <TextInput
              accessibilityLabel="House join ID"
              autoCapitalize="characters"
              autoCorrect={false}
              onChangeText={setJoinCode}
              placeholder="Join ID"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.backgroundSelected,
                  color: theme.text,
                },
              ]}
              value={joinCode}
            />
            <Pressable
              accessibilityRole="button"
              disabled={joining}
              onPress={handleJoinHouse}
              style={[styles.button, { backgroundColor: theme.accent }]}
            >
              <Text style={styles.buttonText}>{joining ? "Joining..." : "Join house"}</Text>
            </Pressable>
          </View>
        )}

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
      </ScrollView>
    </ThemedView>
  );
}

function ResourceStatus({
  title,
  available,
  theme,
}: {
  title: string;
  available: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.resource}>
      <ThemedText style={styles.resourceTitle}>{title}</ThemedText>
      <ThemedText style={[styles.status, { color: available ? theme.success : theme.danger }]}>
        {available ? "Available" : "In use"}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    padding: 24,
    paddingTop: 36,
    paddingBottom: 48,
    gap: 24,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
  },
  houseName: {
    fontSize: 22,
    fontWeight: "600",
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  residentRow: {
    minHeight: 48,
    justifyContent: "center",
    gap: 2,
    paddingVertical: 8,
  },
  secondaryText: {
    fontSize: 14,
  },
  resources: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  resource: {
    flexGrow: 1,
    flexBasis: 220,
    minHeight: 112,
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 8,
  },
  resourceTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  status: {
    fontSize: 18,
    fontWeight: "700",
  },
  joinSection: {
    gap: 16,
    marginTop: 24,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  button: {
    alignItems: "center",
    borderRadius: 8,
    padding: 15,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  link: {
    fontSize: 15,
    fontWeight: "600",
  },
  error: {
    color: "#dc2626",
    fontSize: 14,
  },
  loader: {
    marginTop: 48,
  },
});