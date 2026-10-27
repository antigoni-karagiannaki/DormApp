import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

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

type WashQueueEntry = {
  profile_id: string;
  created_at: string;
  name: string;
};

export default function Home() {
  const [house, setHouse] = useState<House | null>(null);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [washQueue, setWashQueue] = useState<WashQueueEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("You");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [queueUpdating, setQueueUpdating] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadHouse() {
      setLoading(true);
      setError("");

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!sessionData.session) {
          router.replace("/login");
          return;
        }

        const { data: membership, error: membershipError } = await supabase
          .from("house_members")
          .select("house_id")
          .eq("profile_id", sessionData.session.user.id)
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
          const user = sessionData.session.user;
          const profileName = (profileData ?? []).find((profile) => profile.id === user.id)?.name;
          setHouse(houseData as House);
          setCurrentUserId(user.id);
          setCurrentUserName(
            profileName ??
              (typeof user.user_metadata?.name === "string" ? user.user_metadata.name : null) ??
              user.email?.split("@")[0] ??
              "You"
          );
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
          setError(getErrorMessage(loadError, "Could not load your house."));
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

  useEffect(() => {
    const houseId = house?.id;
    if (!houseId) {
      setWashQueue([]);
      return;
    }

    let active = true;

    async function loadWashQueue() {
      try {
        const { data: queueData, error: queueError } = await supabase
          .from("washing_machine_queue")
          .select("profile_id, created_at")
          .eq("house_id", houseId)
          .order("created_at", { ascending: true });
        if (queueError) throw queueError;

        const profileIds = [...new Set((queueData ?? []).map((entry) => entry.profile_id))];
        const { data: profileData, error: profileError } = profileIds.length
          ? await supabase.from("profiles").select("id, name").in("id", profileIds)
          : { data: [], error: null };
        if (profileError) throw profileError;

        const names = new Map(
          (profileData ?? []).map((profile) => [profile.id, profile.name ?? "Resident"])
        );

        if (active) {
          setWashQueue(
            (queueData ?? []).map((entry) => ({
              ...entry,
              name: names.get(entry.profile_id) ?? "Resident",
            }))
          );
        }
      } catch (queueError) {
        if (active) setError(getErrorMessage(queueError, "Could not load the wash queue."));
      }
    }

    void loadWashQueue();
    const intervalId = setInterval(() => void loadWashQueue(), 5000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [house?.id]);

  async function handleWashQueue() {
    if (!house || !currentUserId || queueUpdating) return;

    const alreadyQueued = washQueue.some((entry) => entry.profile_id === currentUserId);
    setQueueUpdating(true);
    setError("");

    try {
      const { error: queueError } = alreadyQueued
        ? await supabase
            .from("washing_machine_queue")
            .delete()
            .eq("house_id", house.id)
            .eq("profile_id", currentUserId)
        : await supabase.from("washing_machine_queue").insert({
            house_id: house.id,
            profile_id: currentUserId,
          });
      if (queueError) throw queueError;

      setWashQueue((queue) =>
        alreadyQueued
          ? queue.filter((entry) => entry.profile_id !== currentUserId)
          : [
              ...queue,
              {
                profile_id: currentUserId,
                created_at: new Date().toISOString(),
                name: currentUserName,
              },
            ]
      );
    } catch (queueError) {
      setError(getErrorMessage(queueError, "Could not update the wash queue."));
    } finally {
      setQueueUpdating(false);
    }
  }

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
      setError(getErrorMessage(joinError, "Could not join that house."));
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
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>POCKET HOUSE</Text>
            <Text style={styles.tagline}>LITTLE WORLD. BIG PERSONALITY.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={handleLogout}
            style={styles.logoutButton}
          >
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={palette.pinkDark} style={styles.loader} />
        ) : house ? (
          <>
            <View style={styles.greetingRow}>
              <Text style={styles.greeting}>Hey, housemates!</Text>
              <Text style={styles.houseLabel}>{house.name || "OUR PLACE"}</Text>
            </View>

            <View style={styles.statusStrip}>
              <StatusMeter label="Residents" value={`${residents.length}`} detail="at home" />
              <StatusMeter
                label="Laundry"
                value={house.washing_machine_available ? "Ready" : "In use"}
                detail="washer"
                active={house.washing_machine_available}
              />
              <StatusMeter
                label="Shower"
                value={house.shower_available ? "Ready" : "In use"}
                detail="shared"
                active={house.shower_available}
              />
            </View>

            <HouseIllustration
              onBedrooms={() => {
                const names = residents.length
                  ? residents.map((resident) => `${resident.name}${resident.room ? ` · ${resident.room}` : ""}`).join("\n")
                  : "No residents found yet.";
                Alert.alert("Bedrooms", names);
              }}
              onKitchen={() => Alert.alert("Kitchen", `A shared space for ${residents.length} ${residents.length === 1 ? "resident" : "residents"}.`)}
              onShower={() => Alert.alert("Shower", house.shower_available ? "The shower is available." : "The shower is currently in use.")}
              onWash={handleWashQueue}
              showerAvailable={house.shower_available}
              washQueue={washQueue}
              currentUserId={currentUserId}
              queueUpdating={queueUpdating}
            />

            <View style={styles.captionRow}>
              <Text style={styles.captionSparkle}>✦</Text>
              <Text style={styles.caption}>Tap a room to see what’s happening.</Text>
              <Text style={styles.captionSparkle}>✦</Text>
            </View>
          </>
        ) : (
          <View style={styles.joinSection}>
            <Text style={styles.joinTitle}>Move into your house</Text>
            <Text style={styles.joinDescription}>
              Enter the join ID shared by a house resident.
            </Text>
            <TextInput
              accessibilityLabel="House join ID"
              autoCapitalize="characters"
              autoCorrect={false}
              onChangeText={setJoinCode}
              placeholder="JOIN ID"
              placeholderTextColor={palette.mauve}
              style={styles.input}
              value={joinCode}
            />
            <Pressable
              accessibilityRole="button"
              disabled={joining}
              onPress={handleJoinHouse}
              style={[styles.button, joining && styles.buttonDisabled]}
            >
              <Text style={styles.buttonText}>{joining ? "Joining..." : "Join house"}</Text>
            </Pressable>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

const palette = {
  ink: "#4B2742",
  mauve: "#8C5A7C",
  pink: "#F45BA2",
  pinkDark: "#C3327A",
  pinkLight: "#FFD0E4",
  cream: "#FFF4DF",
  paper: "#FFF9F1",
  bedroom: "#D6B6F1",
  kitchen: "#FFE0A0",
  utility: "#A8E5D2",
  green: "#25866F",
  red: "#C84A69",
  outline: "#4B2742",
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return fallback;
}

function StatusMeter({
  label,
  value,
  detail,
  active = true,
}: {
  label: string;
  value: string;
  detail: string;
  active?: boolean;
}) {
  return (
    <View style={styles.meter}>
      <Text style={styles.meterLabel}>{label}</Text>
      <Text style={[styles.meterValue, !active && styles.meterInactive]}>{value}</Text>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, active && styles.meterFillActive]} />
      </View>
      <Text style={styles.meterDetail}>{detail}</Text>
    </View>
  );
}

function HouseIllustration({
  onBedrooms,
  onKitchen,
  onShower,
  onWash,
  showerAvailable,
  washQueue,
  currentUserId,
  queueUpdating,
}: {
  onBedrooms: () => void;
  onKitchen: () => void;
  onShower: () => void;
  onWash: () => void;
  showerAvailable: boolean;
  washQueue: WashQueueEntry[];
  currentUserId: string | null;
  queueUpdating: boolean;
}) {
  return (
    <View style={styles.houseWrap}>
      <View style={styles.roof}>
        <View style={[styles.roofStep, styles.roofStepOne]} />
        <View style={[styles.roofStep, styles.roofStepTwo]} />
        <View style={[styles.roofStep, styles.roofStepThree]} />
        <View style={[styles.roofStep, styles.roofStepFour]} />
        <View style={[styles.roofStep, styles.roofStepFive]} />
        <View style={styles.chimney} />
        <View style={styles.roofSign}>
          <Text style={styles.roofSignText}>OUR PLACE</Text>
        </View>
      </View>

      <View style={styles.houseBody}>
        <View style={[styles.floor, styles.bedroomFloor]}>
          <View style={styles.floorLabelRow}>
            <Text style={styles.floorLabel}>3F  BEDROOMS</Text>
            <Text style={styles.floorDots}>•••</Text>
          </View>
          <View style={styles.bedroomScene}>
            <View style={styles.bed}>
              <View style={styles.bedPillow} />
              <View style={styles.bedBlanket} />
              <View style={styles.bedBase} />
            </View>
            <WindowArt />
            <View style={styles.wardrobe}>
              <View style={styles.wardrobeDoor} />
              <View style={styles.wardrobeDoor} />
            </View>
          </View>
          <RoomButton label="Dress up" onPress={onBedrooms} style={styles.bedroomAction} />
        </View>

        <View style={[styles.floor, styles.kitchenFloor]}>
          <View style={styles.floorLabelRow}>
            <Text style={styles.floorLabel}>2F  KITCHEN</Text>
            <Text style={styles.floorDots}>✦</Text>
          </View>
          <View style={styles.kitchenScene}>
            <View style={styles.cabinets}>
              <View style={styles.cabinetTop} />
              <View style={styles.counter} />
              <View style={styles.cabinetRow}>
                <View style={styles.cabinetDoor} />
                <View style={styles.cabinetDoor} />
                <View style={styles.cabinetDoor} />
              </View>
            </View>
            <WindowArt />
            <View style={styles.fridge}>
              <View style={styles.fridgeLine} />
              <View style={styles.fridgeHandle} />
            </View>
          </View>
          <RoomButton label="Cook" onPress={onKitchen} style={styles.kitchenAction} />
        </View>

        <View style={[styles.floor, styles.utilityFloor]}>
          <View style={styles.floorLabelRow}>
            <Text style={styles.floorLabel}>1F  UTILITY</Text>
            <Text style={styles.floorDots}>••</Text>
          </View>
          <View style={styles.utilityScene}>
            <View style={styles.showerCabin}>
              <Text style={styles.showerHead}>⌁</Text>
              <View style={styles.showerDoor} />
            </View>
            <View style={styles.washer}>
              <View style={styles.washerPanel} />
              <View style={styles.washerDoor}>
                <View style={styles.washerGlass}>
                  {washQueue.length > 0 ? (
                    <>
                      <WasherBubble delay={0} left={2} />
                      <WasherBubble delay={350} left={9} />
                      <WasherBubble delay={700} left={15} />
                    </>
                  ) : null}
                </View>
              </View>
            </View>
            <View style={styles.laundryBasket}>
              <Text style={styles.laundryMark}>≋</Text>
            </View>
          </View>
          <View style={styles.utilityActions}>
            <RoomButton
              label={showerAvailable ? "Shower" : "Shower · busy"}
              onPress={onShower}
              style={styles.utilityAction}
            />
            <RoomButton
              label={
                queueUpdating
                  ? "Updating..."
                  : washQueue.some((entry) => entry.profile_id === currentUserId)
                    ? "Leave queue"
                    : "Wash"
              }
              onPress={onWash}
              style={styles.utilityAction}
              disabled={queueUpdating}
            />
          </View>
        </View>
      </View>
      <View style={styles.foundation} />
      <View style={styles.queuePanel}>
        <View style={styles.queueHeading}>
          <Text style={styles.queueTitle}>WASH QUEUE</Text>
          <Text style={styles.queueCount}>{washQueue.length} WAITING</Text>
        </View>
        {washQueue.length ? (
          washQueue.map((entry, index) => (
            <View key={entry.profile_id} style={styles.queueRow}>
              <Text style={styles.queueNumber}>{String(index + 1).padStart(2, "0")}</Text>
              <Text numberOfLines={1} style={styles.queueName}>{entry.name}</Text>
              {entry.profile_id === currentUserId ? (
                <Text style={styles.queueYou}>YOU</Text>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={styles.queueEmpty}>No one waiting. Add yourself to the line.</Text>
        )}
      </View>
    </View>
  );
}

function WasherBubble({ delay, left }: { delay: number; left: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [delay, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [4, -10] });
  const opacity = progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.2, 1, 0] });

  return (
    <Animated.View
      style={[styles.bubble, { left, opacity, transform: [{ translateY }] }]}
    />
  );
}

function WindowArt() {
  return (
    <View style={styles.windowFrame}>
      <View style={styles.windowPane}>
        <View style={styles.windowCrossVertical} />
        <View style={styles.windowCrossHorizontal} />
      </View>
    </View>
  );
}

function RoomButton({
  label,
  onPress,
  style,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  style?: object;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.roomButton,
        style,
        pressed && !disabled && styles.roomButtonPressed,
        disabled && styles.roomButtonDisabled,
      ]}
    >
      <Text numberOfLines={1} style={styles.roomButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.cream,
  },
  content: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
    gap: 15,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  brand: {
    color: palette.pinkDark,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 3,
  },
  tagline: {
    color: palette.ink,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.7,
    marginTop: 2,
  },
  logoutButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  logoutText: {
    color: palette.pinkDark,
    fontSize: 12,
    fontWeight: "800",
  },
  greetingRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  greeting: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  houseLabel: {
    color: palette.green,
    fontSize: 9,
    fontWeight: "900",
    maxWidth: "42%",
    textAlign: "right",
    textTransform: "uppercase",
  },
  statusStrip: {
    backgroundColor: palette.pinkLight,
    borderColor: "#F6A7CB",
    borderRadius: 10,
    borderWidth: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  meter: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 3,
  },
  meterLabel: {
    color: palette.ink,
    fontSize: 9,
    fontWeight: "700",
  },
  meterValue: {
    color: palette.green,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 2,
  },
  meterInactive: {
    color: palette.red,
  },
  meterTrack: {
    backgroundColor: palette.paper,
    borderColor: palette.ink,
    borderRadius: 3,
    borderWidth: 1,
    height: 7,
    marginTop: 4,
    overflow: "hidden",
  },
  meterFill: {
    backgroundColor: palette.red,
    height: "100%",
    width: "45%",
  },
  meterFillActive: {
    backgroundColor: palette.pink,
    width: "82%",
  },
  meterDetail: {
    color: palette.mauve,
    fontSize: 8,
    marginTop: 2,
  },
  houseWrap: {
    width: "100%",
    alignSelf: "center",
    marginTop: 7,
    paddingTop: 85,
  },
  roof: {
    alignItems: "center",
    height: 101,
    justifyContent: "flex-end",
    position: "absolute",
    top: 0,
    width: "100%",
  },
  roofStep: {
    backgroundColor: palette.pink,
    borderColor: palette.outline,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    height: 18,
    position: "absolute",
  },
  roofStepOne: {
    top: 0,
    width: "42%",
  },
  roofStepTwo: {
    top: 16,
    width: "58%",
  },
  roofStepThree: {
    top: 32,
    width: "74%",
  },
  roofStepFour: {
    top: 48,
    width: "88%",
  },
  roofStepFive: {
    top: 64,
    width: "100%",
  },
  chimney: {
    backgroundColor: palette.pink,
    borderColor: palette.outline,
    borderWidth: 3,
    height: 36,
    position: "absolute",
    right: "16%",
    top: 40,
    width: 23,
  },
  roofSign: {
    alignItems: "center",
    backgroundColor: palette.paper,
    borderColor: palette.outline,
    borderWidth: 3,
    bottom: 1,
    justifyContent: "center",
    minHeight: 25,
    position: "absolute",
    width: "49%",
    zIndex: 2,
  },
  roofSignText: {
    color: palette.pinkDark,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 2,
  },
  houseBody: {
    backgroundColor: palette.pink,
    borderColor: palette.outline,
    borderRadius: 4,
    borderWidth: 5,
    overflow: "hidden",
    padding: 3,
  },
  floor: {
    borderColor: palette.outline,
    borderWidth: 3,
    height: 135,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingTop: 7,
    position: "relative",
  },
  bedroomFloor: {
    backgroundColor: palette.bedroom,
  },
  kitchenFloor: {
    backgroundColor: palette.kitchen,
    borderTopWidth: 4,
  },
  utilityFloor: {
    backgroundColor: palette.utility,
    borderTopWidth: 4,
  },
  floorLabelRow: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: palette.paper,
    borderColor: "#DCAFCB",
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    minHeight: 18,
    paddingHorizontal: 5,
    zIndex: 2,
  },
  floorLabel: {
    color: palette.pinkDark,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  floorDots: {
    color: palette.ink,
    fontSize: 8,
    fontWeight: "900",
  },
  bedroomScene: {
    alignItems: "flex-end",
    bottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    left: 10,
    position: "absolute",
    right: 10,
    top: 31,
  },
  bed: {
    height: 49,
    justifyContent: "flex-end",
    marginBottom: 8,
    position: "relative",
    width: "36%",
  },
  bedBase: {
    backgroundColor: "#713B75",
    borderColor: palette.outline,
    borderWidth: 3,
    bottom: 0,
    height: 34,
    left: 0,
    position: "absolute",
    right: 0,
  },
  bedPillow: {
    backgroundColor: palette.paper,
    borderColor: palette.outline,
    borderWidth: 2,
    height: 13,
    left: 4,
    position: "absolute",
    top: 5,
    width: "30%",
    zIndex: 1,
  },
  bedBlanket: {
    backgroundColor: palette.pink,
    borderColor: palette.outline,
    borderWidth: 2,
    height: 24,
    position: "absolute",
    right: 3,
    top: 16,
    width: "68%",
    zIndex: 1,
  },
  windowFrame: {
    backgroundColor: palette.paper,
    borderColor: palette.outline,
    borderWidth: 3,
    height: 47,
    padding: 3,
    width: 53,
  },
  windowPane: {
    backgroundColor: "#8DD8E2",
    flex: 1,
    overflow: "hidden",
  },
  windowCrossVertical: {
    backgroundColor: palette.paper,
    height: "100%",
    left: "47%",
    position: "absolute",
    width: 4,
  },
  windowCrossHorizontal: {
    backgroundColor: palette.paper,
    height: 4,
    position: "absolute",
    top: "47%",
    width: "100%",
  },
  wardrobe: {
    backgroundColor: "#B494E8",
    borderColor: palette.outline,
    borderWidth: 3,
    flexDirection: "row",
    height: 55,
    marginBottom: 3,
    width: "25%",
  },
  wardrobeDoor: {
    borderColor: "#75549B",
    borderRightWidth: 2,
    flex: 1,
    marginVertical: 3,
  },
  roomButton: {
    alignItems: "center",
    backgroundColor: palette.pink,
    borderColor: palette.outline,
    borderRadius: 6,
    borderWidth: 2,
    borderBottomWidth: 4,
    justifyContent: "center",
    minHeight: 29,
    paddingHorizontal: 9,
  },
  roomButtonText: {
    color: palette.paper,
    fontSize: 10,
    fontWeight: "900",
  },
  roomButtonPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2,
  },
  roomButtonDisabled: {
    opacity: 0.65,
  },
  bedroomAction: {
    bottom: 8,
    position: "absolute",
    right: 10,
  },
  kitchenScene: {
    alignItems: "center",
    bottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    left: 10,
    position: "absolute",
    right: 10,
    top: 31,
  },
  cabinets: {
    alignItems: "flex-start",
    justifyContent: "flex-end",
    marginBottom: 4,
    width: "35%",
  },
  cabinetTop: {
    backgroundColor: "#D58B45",
    borderColor: palette.outline,
    borderWidth: 3,
    height: 19,
    width: "95%",
  },
  counter: {
    backgroundColor: "#743F69",
    height: 5,
    width: "100%",
  },
  cabinetRow: {
    flexDirection: "row",
    gap: 2,
    width: "100%",
  },
  cabinetDoor: {
    backgroundColor: "#E6A653",
    borderColor: palette.outline,
    borderWidth: 2,
    height: 22,
    flex: 1,
  },
  fridge: {
    backgroundColor: "#8ED8C5",
    borderColor: palette.outline,
    borderWidth: 3,
    height: 72,
    marginBottom: 2,
    position: "relative",
    width: "19%",
  },
  fridgeLine: {
    backgroundColor: palette.outline,
    height: 2,
    left: 0,
    position: "absolute",
    right: 0,
    top: "43%",
  },
  fridgeHandle: {
    backgroundColor: palette.paper,
    height: 13,
    position: "absolute",
    right: 4,
    top: "52%",
    width: 3,
  },
  kitchenAction: {
    bottom: 8,
    position: "absolute",
    right: 10,
  },
  utilityScene: {
    alignItems: "flex-end",
    bottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    left: 10,
    position: "absolute",
    right: 10,
    top: 30,
  },
  showerCabin: {
    borderColor: "#568C88",
    borderRightWidth: 4,
    borderTopWidth: 4,
    height: 74,
    marginBottom: 1,
    position: "relative",
    width: "25%",
  },
  showerHead: {
    color: "#4F7779",
    fontSize: 21,
    left: 4,
    position: "absolute",
    top: 0,
  },
  showerDoor: {
    backgroundColor: "rgba(255,249,241,0.28)",
    borderColor: "#568C88",
    borderLeftWidth: 3,
    borderTopWidth: 3,
    bottom: 0,
    left: "42%",
    position: "absolute",
    top: 19,
    width: "47%",
  },
  washer: {
    alignItems: "center",
    backgroundColor: "#8F75B1",
    borderColor: palette.outline,
    borderWidth: 3,
    height: 56,
    justifyContent: "space-between",
    marginBottom: 1,
    padding: 4,
    width: "21%",
  },
  washerPanel: {
    backgroundColor: "#D8C6ED",
    borderColor: palette.outline,
    borderWidth: 1,
    height: 6,
    width: "100%",
  },
  washerDoor: {
    alignItems: "center",
    backgroundColor: "#E7D7EF",
    borderColor: palette.outline,
    borderRadius: 20,
    borderWidth: 3,
    height: 29,
    justifyContent: "center",
    width: 29,
  },
  washerGlass: {
    backgroundColor: "#63C7C2",
    borderRadius: 10,
    height: 15,
    overflow: "hidden",
    position: "relative",
    width: 15,
  },
  bubble: {
    backgroundColor: "#E7FFFF",
    borderRadius: 4,
    bottom: 0,
    height: 5,
    position: "absolute",
    width: 5,
  },
  laundryBasket: {
    alignItems: "center",
    backgroundColor: "#2687D5",
    borderColor: palette.outline,
    borderWidth: 2,
    height: 24,
    justifyContent: "center",
    marginBottom: 4,
    width: "16%",
  },
  laundryMark: {
    color: palette.paper,
    fontSize: 16,
    fontWeight: "900",
  },
  utilityActions: {
    alignItems: "center",
    bottom: 8,
    flexDirection: "row",
    gap: 7,
    position: "absolute",
    right: 8,
  },
  utilityAction: {
    minHeight: 27,
    paddingHorizontal: 7,
  },
  foundation: {
    backgroundColor: palette.pinkDark,
    height: 6,
    marginHorizontal: -3,
  },
  queuePanel: {
    backgroundColor: palette.paper,
    borderColor: palette.outline,
    borderWidth: 2,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  queueHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 6,
  },
  queueTitle: {
    color: palette.ink,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  queueCount: {
    color: palette.pinkDark,
    fontSize: 9,
    fontWeight: "900",
  },
  queueRow: {
    alignItems: "center",
    borderTopColor: "#F1D9E5",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 34,
    paddingVertical: 5,
  },
  queueNumber: {
    color: palette.mauve,
    fontSize: 10,
    fontWeight: "800",
  },
  queueName: {
    color: palette.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  queueYou: {
    color: palette.green,
    fontSize: 9,
    fontWeight: "900",
  },
  queueEmpty: {
    borderTopColor: "#F1D9E5",
    borderTopWidth: 1,
    color: palette.mauve,
    fontSize: 11,
    paddingTop: 8,
  },
  captionRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 13,
    marginTop: 1,
  },
  caption: {
    color: palette.mauve,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  captionSparkle: {
    color: palette.green,
    fontSize: 14,
    fontWeight: "900",
  },
  joinSection: {
    backgroundColor: palette.paper,
    borderColor: palette.pink,
    borderWidth: 3,
    gap: 14,
    marginTop: 28,
    padding: 18,
  },
  joinTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "900",
  },
  joinDescription: {
    color: palette.mauve,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    backgroundColor: "#FFFDF9",
    borderColor: palette.pink,
    borderWidth: 2,
    color: palette.ink,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  button: {
    alignItems: "center",
    backgroundColor: palette.pink,
    borderColor: palette.outline,
    borderWidth: 2,
    justifyContent: "center",
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: palette.paper,
    fontSize: 15,
    fontWeight: "900",
  },
  error: {
    color: palette.red,
    fontSize: 13,
    fontWeight: "700",
  },
  loader: {
    marginTop: 48,
  },
});