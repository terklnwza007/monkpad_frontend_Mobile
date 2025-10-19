// src/screens/TransactionsScreen.js
import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  SectionList,
  RefreshControl,
  StyleSheet,
  Pressable,
  Image,
  Animated,
  Alert,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { authedGet, deleteTransaction } from "../lib/api";
import { getToken } from "../lib/auth";
import { getUidFromToken } from "../lib/jwt";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

const makeTxPath = (uid) => `/transactions/${uid}`;
const pad2 = (n) => String(n).padStart(2, "0");
const fmtMoney = (n) =>
  (Number(n || 0)).toLocaleString("th-TH", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });

export default function TransactionsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 64;

  // state
  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState("all"); // all | income | expense
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);

  // ---- fetch ----
  const fetchAll = useCallback(async () => {
    setErr(null);
    try {
      const token = await getToken();
      if (!token) {
        setErr("No token, please login again.");
        setItems([]);
        return;
      }
      const uid = getUidFromToken(token);
      const res = await authedGet(makeTxPath(uid), token);
      const list = Array.isArray(res?.transactions) ? res.transactions : [];
      setItems(list);
    } catch (e) {
      setErr(e?.message || "Failed to load transactions");
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setRefreshing((r) => (!loading ? true : r));
      fetchAll();
      return () => {};
    }, [fetchAll, loading])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  // ---- delete ----
  const handleDelete = async (id) => {
    Alert.alert("ยืนยันการลบ", "คุณต้องการลบรายการนี้หรือไม่?", [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ลบ",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await getToken();
            await deleteTransaction(token, id);
            setItems((prev) => prev.filter((it) => it.id !== id));
          } catch (err) {
            Alert.alert("ผิดพลาด", err.message);
          }
        },
      },
    ]);
  };

  // ---- filter/search ----
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return items.filter((it) => {
      const matchType = filterType === "all" ? true : it.type === filterType;
      const hay = [String(it.tag ?? ""), String(it.note ?? ""), String(it.date ?? "")]
        .join(" ")
        .toLowerCase();
      const matchQuery = kw ? hay.includes(kw) : true;
      return matchType && matchQuery;
    });
  }, [items, q, filterType]);

  // ---- group sections ----
  const todayKey = new Date().toISOString().slice(0, 10);
  const yestKey = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const thHeader = (iso) => {
    if (iso === todayKey) return "วันนี้";
    if (iso === yestKey) return "เมื่อวาน";
    const [y, m, d] = (iso || "").split("-").map(Number);
    const dt = new Date(y || 1970, (m || 1) - 1, d || 1);
    return `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${dt.getFullYear()}`;
  };

  const sections = useMemo(() => {
    if (!Array.isArray(filtered) || !filtered.length) return [];
    const buckets = new Map();
    for (const t of filtered) {
      const k = t.date || "0000-00-00";
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(t);
    }
    const keys = [...buckets.keys()].sort((a, b) => b.localeCompare(a));
    const byTimeDesc = (a, b) => (b.time || "00:00").localeCompare(a.time || "00:00");
    return keys.map((k) => ({
      title: thHeader(k),
      key: k,
      data: buckets.get(k).sort(byTimeDesc),
    }));
  }, [filtered]);

  // ---- totals for summary card ----
  const totalsAll = useMemo(() => {
    let inc = 0,
      exp = 0;
    for (const it of items) {
      if (it.type === "income") inc += Number(it.value || 0);
      else exp += Number(it.value || 0);
    }
    return { income: inc, expense: exp, net: inc - exp };
  }, [items]);

  const renderRightActions = (progress, dragX, itemId) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: "clamp",
    });
    return (
      <Pressable
        onPress={() => handleDelete(itemId)}
        style={{
          backgroundColor: "#DC2626",
          justifyContent: "center",
          alignItems: "flex-end",
          paddingHorizontal: 24,
          borderRadius: 12,
          marginHorizontal: 16,
        }}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="trash-outline" size={22} color="#fff" />
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "top"]}>
      {/* ===== HEADER ===== */}
      <View style={styles.headerWrap}>
        <View style={styles.topBar}>
          <Text style={styles.hTitle}>สินทรัพย์ของฉัน</Text>
          <Pressable
            style={styles.summaryBtn}
            onPress={() => navigation.navigate("Summary")}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Image
                source={require("../../assets/icon/chart.png")}
                style={{ width: 16, height: 16, tintColor: "#fff", marginRight: 6 }}
                resizeMode="contain"
              />
              <Text style={styles.summaryBtnText}>สรุปผลรายการ</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.cardCaption}>ยอดเงินคงเหลือ</Text>
          <Text style={styles.cardBalance}>{fmtMoney(totalsAll.net)} บาท</Text>

          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.cardSubLabel}>รายรับทั้งหมด</Text>
              <Text style={[styles.cardSubAmt, { color: "#10B981" }]}>
                {fmtMoney(totalsAll.income)} บาท
              </Text>
            </View>
            <View>
              <Text style={styles.cardSubLabel}>รายจ่ายทั้งหมด</Text>
              <Text style={[styles.cardSubAmt, { color: "#EF4444" }]}>
                {fmtMoney(totalsAll.expense)} บาท
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ===== FILTER BAR ===== */}
      <View style={styles.filterFixedWrap}>
        <View style={[styles.searchBox, { position: "relative" }]}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="ค้นหารายการ แท็ก, โน้ต, วันที่ (YYYY-MM-DD)"
            placeholderTextColor="#8A94A6"
            style={[styles.searchInput, { paddingLeft: 30, height: 24 }]}
            returnKeyType="search"
          />
          <Image
            source={require("../../assets/icon/search.png")}
            style={{
              position: "absolute",
              left: 10,
              top: 10,
              width: 18,
              height: 18,
              tintColor: "#94A3B8",
            }}
            resizeMode="contain"
          />
        </View>

        <View style={styles.filterRow}>
          <Chip label="ทั้งหมด" active={filterType === "all"} onPress={() => setFilterType("all")} />
          <ChipIncome label="รายรับ" active={filterType === "income"} onPress={() => setFilterType("income")} />
          <ChipExpense label="รายจ่าย" active={filterType === "expense"} onPress={() => setFilterType("expense")} />
        </View>
      </View>

      {/* ===== LIST ===== */}
      <View style={styles.listArea}>
        <SectionList
          sections={sections}
          keyExtractor={(item, idx) =>
            String(item.id ?? `${item.tag_id || "t"}-${item.date}-${item.time}-${idx}`)
          }
          renderItem={({ item }) => (
            <Swipeable
              renderRightActions={(progress, dragX) =>
                renderRightActions(progress, dragX, item.id)
              }
            >
              <Pressable onPress={() => navigation.navigate("EditTransaction", { item })}>
                <Card item={item} />
              </Pressable>
            </Swipeable>
          )}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionText}>{section.title}</Text>
            </View>
          )}
          ListEmptyComponent={
            !loading && !err ? <Text style={styles.empty}>ไม่มีรายการ</Text> : null
          }
          refreshControl={
            <RefreshControl refreshing={refreshing || loading} onRefresh={onRefresh} />
          }
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            paddingBottom: TAB_BAR_HEIGHT + (insets.bottom || 0) + 12,
          }}
        />
      </View>
    </SafeAreaView>
  );
}

/* ===== Components ===== */
function Chip({ label, active, onPress }) {
  return (
    <Text
      onPress={onPress}
      style={[
        styles.chip,
        active ? { backgroundColor: "#000", color: "#fff" } : null,
      ]}
    >
      {label}
    </Text>
  );
}

function ChipIncome({ label, active, onPress }) {
  return (
    <Text
      onPress={onPress}
      style={[
        styles.chip,
        active ? { backgroundColor: "#16a34ae0", color: "#fff" } : null,
      ]}
    >
      {label}
    </Text>
  );
}

function ChipExpense({ label, active, onPress }) {
  return (
    <Text
      onPress={onPress}
      style={[
        styles.chip,
        active ? { backgroundColor: "#dc2626d5", color: "#fff" } : null,
      ]}
    >
      {label}
    </Text>
  );
}

function Card({ item }) {
  const type = item.type === "income" ? "income" : "expense";
  const sign = type === "expense" ? "-" : "+";
  const val = Number(item.value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const t = (item.time || "").slice(0, 5);
  const tagName = item.tag ?? `Tag #${item.tag_id}`;
  const note = item.note || "";
  const iconName =
    type === "income" ? "arrow-down-circle-outline" : "arrow-up-circle-outline";
  const iconColor = type === "income" ? "#16A34A" : "#DC2626";

  return (
    <View style={styles.txCard}>
      <View style={styles.txRow}>
        <View style={[styles.txIcon, { backgroundColor: iconColor + "15" }]}>
          <Ionicons name={iconName} size={22} color={iconColor} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.txTag}>{tagName}</Text>
          {note ? <Text style={styles.txNote}>{note}</Text> : null}
          <Text style={styles.txDate}>
            {item.date}
            {t ? ` • ${t}` : ""}
          </Text>
        </View>

        <Text style={[styles.txAmt, { color: iconColor }]}>
          {sign}{val}
        </Text>
      </View>
    </View>
  );
}


/* ===== Styles ===== */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  headerWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#000",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  hTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  summaryBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  summaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  summaryCard: {
    backgroundColor: "#202124",
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
  },
  cardCaption: { color: "#C7CBD6", fontSize: 13, marginBottom: 6, fontWeight: "600" },
  cardBalance: { color: "#fff", fontSize: 28, fontWeight: "900", marginBottom: 10 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between" },
  cardSubLabel: { color: "#C7CBD6", fontSize: 12 },
  cardSubAmt: { fontSize: 16, fontWeight: "800", marginTop: 2 },

  filterFixedWrap: {
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  searchBox: {
    backgroundColor: "#E8EDF5",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { color: "#111827" },
  filterRow: { flexDirection: "row", gap: 8, marginTop: 10 },

  listArea: { flex: 1, backgroundColor: "#F9FAFB" },
  sectionHeader: {
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomColor: "#E5E7EB",
    borderBottomWidth: 1,
    marginBottom: 6,
  },
  sectionText: { color: "#000000ff", fontWeight: "800", fontSize: 14 },

  txCard: {
    backgroundColor: "#ffffffff",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: "#000000ff",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  txRow: { flexDirection: "row", alignItems: "center" },
  txIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  txTag: { color: "#111827", fontSize: 15, fontWeight: "700" },
  txNote: { color: "#6B7280", fontSize: 13, marginTop: 2 },
  txDate: { color: "#9CA3AF", fontSize: 11, marginTop: 2 },
  txAmt: { fontSize: 15, fontWeight: "800" },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    color: "#111827",
    fontWeight: "700",
    overflow: "hidden",
    marginLeft: 2,
  },
  empty: { textAlign: "center", color: "#6B7280", marginTop: 24 },
});
