// src/navigation/Tabs.js
import React from "react";
import { View, Pressable } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useWindowDimensions } from "react-native";

// screens
import TransactionsScreen from "../screens/TransactionsScreen";
import SettingScreen from "../screens/SettingScreen";



// ปุ่มลอย “+” แบบ overlay จริงๆ (อยู่นอก Tab.Navigator)
function FloatingAddButton() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();

  const SIZE = 64;
  const TAB_BASE = 64; // ความสูงแท็บ (ไม่รวม safe area)
  // จัดให้อยู่กึ่งกลางแนวนอน และวางทับกึ่งกลางแท็บบาร์พอดี (โผล่ขึ้นเล็กน้อย)
  const left = (width - SIZE) / 2;
  const LIFT = 14;         // ← ยกปุ่มให้โผล่ขึ้นเหนือถาดนิดนึง (ปรับ 10–18 ได้ตามชอบ)
  const bottom = (TAB_BASE - SIZE) / 2 + Math.max(8, insets.bottom || 0) + LIFT;

  return (
    <Pressable
      onPress={() => navigation.navigate("AddTransaction")}
      style={{
        position: "absolute",
        left,
        bottom,
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#2563EB",
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
        zIndex: 999, // ทับทุกอย่าง
      }}
      hitSlop={10}
    >
      <Ionicons name="add" size={34} color="#fff" />
    </Pressable>
  );
}

const Tab = createBottomTabNavigator();

export default function Tabs() {
  const insets = useSafeAreaInsets();

  const TAB_BASE = 64;
  const tabHeight = TAB_BASE + (insets.bottom || 0);

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: "#FFFFFF",
          tabBarInactiveTintColor: "#9CA3AF",
          tabBarStyle: {
            backgroundColor: "#0B0B0D",
            height: tabHeight,
            paddingBottom: Math.max(8, insets.bottom || 0),
            paddingTop: 8,
            borderTopWidth: 0,
          },
          tabBarLabelStyle: { fontWeight: "700", fontSize: 12, marginTop: 2 },
        }}
        sceneContainerStyle={{ backgroundColor: "#F4F6FA" }}
      >
        {/* 1) หน้าหลัก */}
        <Tab.Screen
          name="TransactionsHome"
          component={TransactionsScreen}
          options={{
            title: "หน้าหลัก",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
            ),
          }}
        />

        {/* 2) แท็บกลาง: ทำเป็นช่องว่าง (ไม่โผล่ไอคอน ไม่กดได้) เพื่อรักษา layout เดิม */}
        <Tab.Screen
          name="AddEntryDummy"
          component={View} // ไม่ใช้จริง
          options={{
            title: "เพิ่มรายการ",
            tabBarLabel: " ", // ซ่อนข้อความ
            tabBarIcon: () => <MaterialCommunityIcons name="plus-circle" size={22} color="transparent" />,
            tabBarButton: () => <View style={{ flex: 1 }} pointerEvents="none" />, // เว้นช่องไว้เฉยๆ
          }}
          listeners={{
            tabPress: (e) => e.preventDefault(), // กันการสลับแท็บ
          }}
        />

        {/* 3) ตั้งค่า */}
        <Tab.Screen
          name="Settings"
          component={SettingScreen}
          options={{
            title: "ตั้งค่า",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "settings" : "settings-outline"} size={22} color={color} />
            ),
          }}
        />
      </Tab.Navigator>

      {/* ปุ่มลอย overlay จริงๆ — อยู่กึ่งกลางหน้าจอแบบไม่กระทบ layout อื่น */}
      <FloatingAddButton />
    </View>
  );
}
