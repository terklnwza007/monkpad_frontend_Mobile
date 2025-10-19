// src/screens/SummaryDetailScreen.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { PieChart } from "react-native-chart-kit";
import { useWindowDimensions } from "react-native";

import { authedGet } from "../lib/api";
import { getToken } from "../lib/auth";
import { getUidFromToken } from "../lib/jwt";

// สีกราฟ
const PIE_COLORS = [
  "#1E88E5", "#FDD835", "#7CB342", "#FB8C00", "#8E24AA",
  "#E53935", "#00ACC1", "#6D4C41", "#43A047", "#FFC107",
  "#3949AB", "#F4511E", "#00897B", "#C2185B", "#AFB42B",
  "#5E35B1", "#039BE5", "#D81B60", "#757575", "#009688",
  "#FF7043", "#303F9F", "#9E9D24", "#BDBDBD", "#4CAF50",
];

const baht = (n) =>
  Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });

const DEFAULT_CHART_CONFIG = {
  backgroundGradientFrom: "#15171B",
  backgroundGradientTo: "#15171B",
  decimalPlaces: 0,
  color: (o = 1) => `rgba(199, 204, 214, ${o})`,
  labelColor: (o = 1) => `rgba(199, 204, 214, ${o})`,
};

// === หน้ารายละเอียด ===
export default function SummaryDetailScreen() {
  const nav = useNavigation();
  const { width } = useWindowDimensions();
  const route = useRoute();

  // ได้ค่ามาจาก SummaryScreen: { mode: 'income' | 'expense', title? }
  const mode = route.params?.mode === "expense" ? "expense" : "income";
  const title = route.params?.title || (mode === "income" ? "รายรับ" : "รายจ่าย");

  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState([]); // [{name, amount}]
  const [q, setQ] = useState("");
  const [sortAsc, setSortAsc] = useState(false); // ดีฟอลต์: มาก->น้อย

  const chartWidth = Math.max(320, width - 32);
  const CHART_HEIGHT = 200;
  const CHART_PADDING_LEFT = Math.max(0, (chartWidth - CHART_HEIGHT) / 2  + 6 );

  // ดึง tags ทั้งหมดแล้วแยกตามประเภท จากนั้น sort และแตก "อื่นๆ" ออกเอง
  const fetchAllTags = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const uid = await getUidFromToken(token);
      const tagsRes = await authedGet(`/tags/${uid}`, token);
      const items = Array.isArray(tagsRes?.items)
        ? tagsRes.items
        : Array.isArray(tagsRes)
        ? tagsRes
        : [];

      const pairs = [];
      items.forEach((t) => {
        const type = String(t?.type || "");
        if (type === mode) {
          const name = t?.tag || "ไม่ทราบ";
          const amount = Math.abs(Number(t?.value || 0));
          if (amount > 0) pairs.push({ name, amount });
        }
      });

      // รวมชื่อเดียวกัน
      const byName = new Map();
      pairs.forEach(({ name, amount }) => {
        byName.set(name, (byName.get(name) || 0) + amount);
      });

      const full = Array.from(byName.entries()).map(([name, amount]) => ({
        name,
        amount,
      }));
      full.sort((a, b) => b.amount - a.amount);
      setRaw(full);
    } catch (e) {
      console.warn("SummaryDetail fetch error:", e?.message || e);
      setRaw([]);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    fetchAllTags();
  }, [fetchAllTags]);

  const total = useMemo(
    () => raw.reduce((s, x) => s + (x?.amount || 0), 0),
    [raw]
  );

  // filter + sort
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const arr = kw
      ? raw.filter((x) => (x?.name || "").toLowerCase().includes(kw))
      : raw.slice();
    arr.sort((a, b) => (sortAsc ? a.amount - b.amount : b.amount - a.amount));
    return arr;
  }, [raw, q, sortAsc]);

  // สร้างข้อมูลสำหรับ PieChart (ไม่มี legend ในกราฟ)
  const pieData = useMemo(() => {
    const arr = filtered.length ? filtered : [{ name: "ไม่มีข้อมูล", amount: 1 }];
    return arr.map((x, i) => ({
      name: x.name,
      amount: x.amount,
      population: x.amount,
      color: PIE_COLORS[i % PIE_COLORS.length],
      legendFontColor: "#C7CCD6",
      legendFontSize: 12,
    }));
  }, [filtered]);

  // --- render item แถวลิสต์ ---
  const renderItem = useCallback(
    ({ item, index }) => {
      const pct = total > 0 ? (item.amount * 100) / total : 0;
      return (
        <View key={`${item.name}-${index}`} style={styles.itemRow}>
          <View style={styles.itemLeft}>
            <View
              style={[
                styles.dot,
                { backgroundColor: PIE_COLORS[index % PIE_COLORS.length] },
              ]}
            />
            <View>
              <Text style={styles.itemName}>{item.name}</Text>
            </View>
          </View>

          <View style={styles.itemRight}>
            <Text style={styles.itemPct}>{pct.toFixed(2)} %</Text>
            <Text style={styles.itemAmt}>{baht(item.amount)}</Text>
          </View>
        </View>
      );
    },
    [total]
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => nav.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* ===== ส่วนบน "fixed" (ไม่เลื่อน): กราฟ + สรุปยอด + ค้นหา/เรียง ===== */}
      <View style={styles.fixedTop}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {mode === "income" ? "สัดส่วนรายรับ" : "สัดส่วนรายจ่าย"}
          </Text>
          <View style={{ alignItems: "center", justifyContent: "center" }}>
            <PieChart
                data={pieData}
                accessor="population"
                width={chartWidth}
                height={CHART_HEIGHT}
                backgroundColor="transparent"
                paddingLeft={String(CHART_PADDING_LEFT)}
                hasLegend={false}
                chartConfig={DEFAULT_CHART_CONFIG}
                style={{ alignSelf: "center" }}
            />
            </View>
          <Text style={styles.subNote}>รวมทั้งหมด {baht(total)} บาท</Text>
        </View>

        <View style={styles.toolsRow}>
          <View style={styles.searchBox}>
            <Image
                            source={require("../../assets/icon/search.png")}
                            style={{ width: 16, height: 16, tintColor: "#fff", marginRight: 6 }}
                            resizeMode="contain"
                          />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="ค้นหารายการ (แท็ก)"
              placeholderTextColor="#9AA3B2"
              style={styles.searchInput}
            />
          </View>

          <Pressable
            style={styles.sortBtn}
            onPress={() => setSortAsc((v) => !v)}
          >
            <Text style={styles.sortText}>
              {sortAsc ? "เรียงน้อย→มาก" : "เรียงมาก→น้อย"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ===== ส่วนล่าง "เลื่อนอย่างเดียว": ลิสต์แท็ก ===== */}
      <View style={styles.scrollArea}>
        {loading ? (
          <ActivityIndicator color="#C7CCD6" style={{ marginTop: 24 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item, idx) => `${item.name}-${idx}`}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E1116" },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 8,
    justifyContent: "space-between",
  },
  backBtn: {
    width: 38,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A1F27",
  },
  backText: { color: "#E6E9EF", fontSize: 20, fontWeight: "600" },
  headerTitle: { color: "#E6E9EF", fontSize: 17, fontWeight: "bold" },

  // ส่วนบน fixed
  fixedTop: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },

  card: {
    backgroundColor: "#161A20",
    borderRadius: 14,
    padding: 12,
    marginTop: 2,
  },
  cardTitle: {
    color: "#E6E9EF",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  subNote: { color: "#8F97A8", fontSize: 12, marginTop: 6 },

  toolsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#12161B",
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    borderWidth: 1,
    borderColor: "#1E2430",
  },
  searchIcon: { color: "#9AA3B2", marginRight: 6, fontSize: 13 },
  searchInput: { color: "#E6E9EF", flex: 1, fontSize: 14 },

  sortBtn: {
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#12161B",
    borderWidth: 1,
    borderColor: "#1E2430",
  },
  sortText: { color: "#E6E9EF", fontSize: 12 },

  // พื้นที่เลื่อนลิสต์อย่างเดียว
  scrollArea: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  listContent: {
    paddingBottom: 24,
  },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2A2F3A",
    justifyContent: "space-between",
  },
  itemLeft: { flexDirection: "row", alignItems: "center" },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  itemName: { color: "#E6E9EF", fontSize: 14, fontWeight: "500" },

  itemRight: { alignItems: "flex-end" },
  itemPct: { color: "#9AA3B2", fontSize: 12, marginBottom: 4 },
  itemAmt: { color: "#E6E9EF", fontSize: 14, fontWeight: "600" },
});
