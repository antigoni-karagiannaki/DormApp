import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { supabase } from "../../../lib/supabase";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";

export default function Index() {
  const theme = useTheme();

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    const { data } = await supabase.auth.getSession();

    if (data.session) {
      router.replace("/home");
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Dorm App</ThemedText>

      <ThemedText style={styles.subtitle}>
        Your shared house, all in one place.
      </ThemedText>

      <Pressable
        style={styles.button}
        onPress={() => router.push("/login")}
      >
        <Text style={styles.buttonText}>Log In</Text>
      </Pressable>

      <Pressable
        style={[styles.secondaryButton, { borderColor: theme.accent }]}
        onPress={() => router.push("/signup")}
      >
        <ThemedText style={[styles.secondaryButtonText, { color: theme.accent }]}>Create Account</ThemedText>
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
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 40,
  },
  button: {
    backgroundColor: "#1e40af",
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#1e40af",
    padding: 16,
    borderRadius: 10,
  },
  secondaryButtonText: {
    color: "#1e40af",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
});

// import { useEffect, useState } from "react";
// import { StyleSheet, Text, View } from "react-native";
// import { supabase } from "../../lib/supabase";

// export default function HomeScreen() {
//   const [status, setStatus] = useState("Testing connection...");
//   const [data, setData] = useState<any[]>([]);

//   useEffect(() => {
//     testConnection();
//   }, []);

//   async function testConnection() {
//     const { data, error } = await supabase
//       .from("houses")
//       .select("*");

//     console.log("SUPABASE DATA:", data);
//     console.log("SUPABASE ERROR:", error);

//     if (error) {
//       setStatus(`❌ Error: ${error.message}`);
//     } else {
//       setStatus("✅ Connected to Supabase!");
//       setData(data ?? []);
//     }
//   }

//   return (
//     <View style={styles.container}>
//       <Text style={styles.title}>Dorm App</Text>

//       <Text>{status}</Text>

//       <Text style={styles.data}>
//         Houses found: {data.length}
//       </Text>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//     padding: 20,
//   },
//   title: {
//     fontSize: 28,
//     fontWeight: "bold",
//     marginBottom: 20,
//   },
//   data: {
//     marginTop: 10,
//   },
// });

// // import * as Device from 'expo-device';
// // import { Platform, StyleSheet } from 'react-native';
// // import { SafeAreaView } from 'react-native-safe-area-context';

// // import { AnimatedIcon } from '@/components/animated-icon';
// // import { HintRow } from '@/components/hint-row';
// // import { ThemedText } from '@/components/themed-text';
// // import { ThemedView } from '@/components/themed-view';
// // import { WebBadge } from '@/components/web-badge';
// // import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

// // function getDevMenuHint() {
// //   if (Platform.OS === 'web') {
// //     return <ThemedText type="small">use browser devtools</ThemedText>;
// //   }
// //   if (Device.isDevice) {
// //     return (
// //       <ThemedText type="small">
// //         shake device or press <ThemedText type="code">m</ThemedText> in terminal
// //       </ThemedText>
// //     );
// //   }
// //   const shortcut = Platform.OS === 'android' ? 'cmd+m (or ctrl+m)' : 'cmd+d';
// //   return (
// //     <ThemedText type="small">
// //       press <ThemedText type="code">{shortcut}</ThemedText>
// //     </ThemedText>
// //   );
// // }

// // export default function HomeScreen() {
// //   return (
// //     <ThemedView style={styles.container}>
// //       <SafeAreaView style={styles.safeArea}>
// //         <ThemedView style={styles.heroSection}>
// //           <AnimatedIcon />
// //           <ThemedText type="title" style={styles.title}>
// //             Welcome to&nbsp;Expo
// //           </ThemedText>
// //         </ThemedView>

// //         <ThemedText type="code" style={styles.code}>
// //           get started
// //         </ThemedText>

// //         <ThemedView type="backgroundElement" style={styles.stepContainer}>
// //           <HintRow
// //             title="Try editing"
// //             hint={<ThemedText type="code">src/app/index.tsx</ThemedText>}
// //           />
// //           <HintRow title="Dev tools" hint={getDevMenuHint()} />
// //           <HintRow
// //             title="Fresh start"
// //             hint={<ThemedText type="code">npm run reset-project</ThemedText>}
// //           />
// //         </ThemedView>

// //         {Platform.OS === 'web' && <WebBadge />}
// //       </SafeAreaView>
// //     </ThemedView>
// //   );
// // }

// // const styles = StyleSheet.create({
// //   container: {
// //     flex: 1,
// //     justifyContent: 'center',
// //     flexDirection: 'row',
// //   },
// //   safeArea: {
// //     flex: 1,
// //     paddingHorizontal: Spacing.four,
// //     alignItems: 'center',
// //     gap: Spacing.three,
// //     paddingBottom: BottomTabInset + Spacing.three,
// //     maxWidth: MaxContentWidth,
// //   },
// //   heroSection: {
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //     flex: 1,
// //     paddingHorizontal: Spacing.four,
// //     gap: Spacing.four,
// //   },
// //   title: {
// //     textAlign: 'center',
// //   },
// //   code: {
// //     textTransform: 'uppercase',
// //   },
// //   stepContainer: {
// //     gap: Spacing.three,
// //     alignSelf: 'stretch',
// //     paddingHorizontal: Spacing.three,
// //     paddingVertical: Spacing.four,
// //     borderRadius: Spacing.four,
// //   },
// // });
