// src/screens/SummaryScreen.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  StyleSheet,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useWindowDimensions } from "react-native";
import { BarChart, PieChart } from "react-native-chart-kit";

import { authedGet } from "../lib/api";
import { getToken } from "../lib/auth";
import { getUidFromToken } from "../lib/jwt";

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const baht = (n) => Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });

// --- สี/ตั้งค่าชาร์ต
const PIE_COLORS = [
  "#1E88E5", // ฟ้าน้ำเงิน (ชัดเจน เหมาะกับหมวดหลัก)
  "#FDD835", // เหลืองทอง (เด่นมาก)
  "#7CB342", // เขียวมะนาว
  "#FB8C00", // ส้มสด (หมวดอื่น)
  "#8E24AA", // ม่วง (หมวดทั่วไป)
  "#BDBDBD", // เทากลาง (หมวดเบลอ)
];



// ค่าคงที่ (วางไว้ด้านบนไฟล์ถ้ายังไม่มี)

const CHART_PAD_TOP = 16;
const CHART_PAD_BOTTOM = 24;
const Y_AXIS_WIDTH = 56;
const Y_TICKS = 5;




const DEFAULT_CHART_CONFIG = {
  backgroundGradientFrom: "#15171B",
  backgroundGradientTo: "#15171B",
  decimalPlaces: 0,
  color: (o = 1) => `rgba(199, 204, 214, ${o})`,
  labelColor: (o = 1) => `rgba(199, 204, 214, ${o})`,
  barPercentage: 0.9, // 1 แท่ง/ช่อง
};

// --- utils
const toArray = (v) => (Array.isArray(v) ? v : (v && Array.isArray(v.items) ? v.items : []));

// formatter แกน Y เป็น k/M และตัด .0
const fmtM = (v) => {
  const n = Number(v || 0);
  const trim = (s) => s.replace(/\.0$/, "");
  if (Math.abs(n) >= 1_000_000) return trim((n / 1_000_000).toFixed(1)) + "M";
  if (Math.abs(n) >= 1_000) return trim((n / 1_000).toFixed(1)) + "k";
  return String(n);
};

// ปัดเพดานแกน Y แบบพอดี (เช่น 20.9M -> 25M ไม่เด้งไป 50M)
const niceCeilTight = (x) => {
  const v = Math.max(1, Number(x || 0));
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const d = v / p;
  const steps = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10];
  const step = steps.find((s) => d <= s) ?? 10;
  return step * p;
};

export default function SummaryScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useNavigation();

  // ปีคุมเฉพาะกราฟแท่ง (ย้อนหลัง 2 ปีถึงปีปัจจุบัน)
  const currentYear = new Date().getFullYear();
  const MIN_YEAR = currentYear - 2;
  const MAX_YEAR = currentYear;
  const [year, setYear] = useState(currentYear);

  // สถานะโหลด
  const [loadingBars, setLoadingBars] = useState(true);
  const [loadingPies, setLoadingPies] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ข้อมูลกราฟ
  const [bars, setBars] = useState(
    Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }))
  );
  const [pieIncome, setPieIncome] = useState([]); // [{name, amount}]
  const [pieExpense, setPieExpense] = useState([]);

  const chartWidth = Math.max(320, width - 32);
  const CHART_HEIGHT = 240;
  

  // ----- Fetchers
  const fetchBars = useCallback(async (targetYear) => {
    setLoadingBars(true);
    try {
      const token = await getToken();
      const uid = await getUidFromToken(token);
      const monthly = await authedGet(`/month_results/${uid}/${targetYear}`, token);
      const byMonth = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));
      toArray(monthly).forEach((row) => {
        const i = Math.max(0, Math.min(11, (row?.month || 1) - 1));
        byMonth[i] = {
          income: Number(row?.income || 0),
          expense: Number(row?.expense || 0),
        };
      });
      setBars(byMonth);
    } catch (e) {
      console.warn("Bar fetch error:", e?.message || e);
      setBars(Array.from({ length: 12 }, () => ({ income: 0, expense: 0 })));
    } finally {
      setLoadingBars(false);
    }
  }, []);

  const fetchPies = useCallback(async () => {
    setLoadingPies(true);
    try {
      const token = await getToken();
      const uid = await getUidFromToken(token);
      let tags = [];
      try {
        const raw = await authedGet(`/tags/${uid}`, token);
        tags = toArray(raw);
      } catch (_) {
        tags = [];
      }
      const incomePairs = [];
      const expensePairs = [];
      tags.forEach((t) => {
        const name = t?.tag || "อื่นๆ";
        const amount = Math.abs(Number(t?.value || 0));
        if (String(t?.type) === "income") incomePairs.push({ name, amount });
        else if (String(t?.type) === "expense") expensePairs.push({ name, amount });
      });

      // Top 5 + รวมเป็น "อื่นๆ"
      const top5 = (arr) => {
        const sorted = [...arr].sort((a, b) => b.amount - a.amount);
        if (sorted.length === 0) return [];
        if (sorted.length <= 5) return sorted.slice(0, 5);
        const head = sorted.slice(0, 4);
        const tailSum = sorted.slice(4).reduce((s, x) => s + x.amount, 0);
        return [...head, { name: "อื่นๆ", amount: tailSum }];
      };

      setPieIncome(top5(incomePairs));
      setPieExpense(top5(expensePairs));
    } catch (e) {
      console.warn("Pie fetch error:", e?.message || e);
      setPieIncome([]);
      setPieExpense([]);
    } finally {
      setLoadingPies(false);
    }
  }, []);

  // mount: โหลดกราฟแท่งปีปัจจุบัน + พายตลอดเวลา
  useEffect(() => { fetchBars(year); fetchPies(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // เปลี่ยนปี: โหลดเฉพาะกราฟแท่ง
  useEffect(() => { fetchBars(year); }, [year, fetchBars]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchBars(year), fetchPies()]);
    setRefreshing(false);
  };

  // ----- เตรียมข้อมูลกราฟแท่งแบบ “เดือนละ 2 แท่ง”
  const barPairs = useMemo(() => {
    const labelsForXAxis = [];
    const data = [];
    for (let i = 0; i < 12; i++) {
      const inc = Number(bars[i]?.income || 0);
      const exp = Number(bars[i]?.expense || 0);
      labelsForXAxis.push(THAI_MONTHS_SHORT[i]); // แสดงเดือนครั้งเดียว
      labelsForXAxis.push("");                   // ช่องว่างตำแหน่ง "จ่าย"
      data.push(inc); // รับ = เขียว
      data.push(exp); // จ่าย = แดง
    }
    return { labelsForXAxis, data };
  }, [bars]);

  // ----- y-axis (fixed)
  const yMaxRaw = Math.max(1, ...barPairs.data);
  const yMax = niceCeilTight(yMaxRaw);
  const yTicks = 5; // จำนวนเส้น/ตัวเลขแกน
  const yValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((yMax * (yTicks - i)) / yTicks)
  ); // ได้ [yMax, ..., 0]

  // ----- pie helpers
  const ensureNonEmpty = (arr, label = "ไม่มีข้อมูล") =>
    Array.isArray(arr) && arr.length > 0 ? arr : [{ name: label, amount: 1 }];

  const toPieData = (arr, labelWhenEmpty) =>
    ensureNonEmpty(arr, labelWhenEmpty).map((x, i) => ({
      name: x?.name ?? "ไม่ทราบ",
      amount: Number(x?.amount || 0),
      population: Number(x?.amount || 0),
      legendFontSize: 12,
      legendFontColor: "#C7CCD6",
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));

  return (
    <SafeAreaView style={styles.container} edges={['left' , 'right']}>
      {/* Header + ปี (คุมเฉพาะกราฟแท่ง) */}
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => setYear((y) => Math.max(MIN_YEAR, y - 1))}
          style={[styles.yearBtn, year <= MIN_YEAR && { opacity: 0.5 }]}
          disabled={year <= MIN_YEAR}
        >
          <Text style={styles.yearBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>เปรียบเทียบรายรับรายจ่ายรายเดือน</Text>
        <Pressable
          onPress={() => setYear((y) => Math.min(MAX_YEAR, y + 1))}
          style={[styles.yearBtn, year >= MAX_YEAR && { opacity: 0.5 }]}
          disabled={year >= MAX_YEAR}
        >
          <Text style={styles.yearBtnText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.yearPill}>
        <Text style={styles.yearPillText}>{year}</Text>
        
      </View>

      <ScrollView
        
        contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 12) }}
contentInsetAdjustmentBehavior="never"
automaticallyAdjustContentInsets={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ===== กราฟแท่ง: แกนซ้ายคงที่ + นำกราฟ 1 ขั้น ===== */}
<View style={styles.card}>
  {loadingBars ? (
    <ActivityIndicator />
  ) : (
    <>
      {(() => {
  // 1) เตรียม labels / data (ค่าจริง ไม่สเกล)
  const labelsForXAxis = [];
  const data = [];
  for (let i = 0; i < 12; i++) {
    labelsForXAxis.push(THAI_MONTHS_SHORT[i]);
    labelsForXAxis.push("");
    data.push(Number(bars[i]?.income || 0));  // รับ
    data.push(Number(bars[i]?.expense || 0)); // จ่าย
  }

  // 2) เพดานแกน Y (ค่าจริง) + จะใช้เป็น guard bar
  const yMaxRaw = Math.max(1, ...data);
  const yMax = niceCeilTight(yMaxRaw);    // เพดานพอดี ๆ (ไม่พุ่งไป 50M ง่าย ๆ)
  const displayMax = yMax;                // ถ้าอยาก “เผื่อหัว 1 ขั้น” ให้ใช้ yMax * 1.1 หรือนิยาม step เอง
  const step = displayMax / Y_TICKS;

  const yValues = Array.from({ length: Y_TICKS + 1 }, (_, i) =>
    Math.round((displayMax * (Y_TICKS - i)) / Y_TICKS)
  );

  // 3) เพิ่มแท่งล่องหนเพื่อ “ล็อกสเกล” ชาร์ต
  const dataWithGuard = [...data, displayMax];
  const labelsWithGuard = [...labelsForXAxis, ""];

  // สีสลับ รับ/จ่าย + สีโปร่งใสให้แท่งสุดท้าย (guard bar)
  const colors = dataWithGuard.map((_, idx) => {
    const isGuard = idx === dataWithGuard.length - 1;
    if (isGuard) {
      return (opacity = 10) => `#15171B`; // โปร่งใส
    }
    return idx % 2 === 0
      ? (opacity = 1) => `rgba(52, 199, 89, ${opacity})`   // รับ
      : (opacity = 1) => `rgba(255, 59, 48, ${opacity})`;   // จ่าย
  });

  const totalBars = dataWithGuard.length;
  const BAR_SLOT = 48;
  const barChartWidth = Math.max(chartWidth - 20, totalBars * BAR_SLOT);

  return (
    <View style={{ flexDirection: "row" }}>
      {/* แกน Y คงที่ */}
      <View
        style={{
          width: Y_AXIS_WIDTH,
          height: CHART_HEIGHT,
          paddingRight: 6,
          paddingTop: CHART_PAD_TOP,
          paddingBottom: CHART_PAD_BOTTOM,
        }}
      >
        <View style={{ flex: 1, justifyContent: "space-between" }}>
          {yValues.map((v, idx) => (
            <Text key={idx} style={styles.yTick}>{fmtM(v)}</Text>
          ))}
        </View>
      </View>

      {/* พื้นที่ชาร์ตเลื่อนแนวนอน */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingLeft: 8, paddingRight: 8 }}
      >
        <BarChart
          data={{
            labels: labelsWithGuard,
            datasets: [{ data: dataWithGuard, colors }],
          }}
          width={barChartWidth}
          height={CHART_HEIGHT}
          fromZero
          withInnerLines
          withHorizontalLabels={false}
          segments={Y_TICKS}
          yAxisLabel=""
          yAxisSuffix=""
          chartConfig={DEFAULT_CHART_CONFIG}
          withCustomBarColorFromData
          flatColor
          showBarTops={false}
          style={{
            marginLeft: -8,
            paddingTop: CHART_PAD_TOP,
            paddingBottom: CHART_PAD_BOTTOM,
          }}
          formatXLabel={(l) => l}
        />
      </ScrollView>
    </View>
  );
})()}

      <View style={{ flexDirection: "row", alignItems: "center" , alignSelf : "center"  }}>
        <View style={[styles.colorDot, { backgroundColor: "#43A047", marginLeft: 16 }]} />
  <Text style={styles.noteText}>รายรับ    </Text>
  <View style={[styles.colorDot, { backgroundColor: "#E53935" }]} />
  <Text style={styles.noteText }>รายจ่าย</Text>

  
</View>
      
    </>
  )}
</View>



        {/* ===== พาย: รายรับ (ตลอดเวลา) ===== */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>สัดส่วนรายรับ</Text>
          </View>
          {loadingPies ? (
            <ActivityIndicator />
          ) : (
            <View style={{ alignItems: "center" }}>
              <PieChart
                data={toPieData(pieIncome, "ไม่มีข้อมูลรายรับ")}
                width={chartWidth - 16}
                height={210}
                accessor={"population"}
                backgroundColor={"transparent"}
                paddingLeft={"0"}
                absolute={false}
                hasLegend={true}
                chartConfig={DEFAULT_CHART_CONFIG}
              />
              <Text style={styles.subNote}>
                รวมทั้งหมด {baht(pieIncome.reduce((s, x) => s + (x?.amount || 0), 0))} บาท
              </Text>
            </View>
          )}
        </View>

        {/* ===== พาย: รายจ่าย (ตลอดเวลา) ===== */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>สัดส่วนรายจ่าย</Text>
          </View>
          {loadingPies ? (
            <ActivityIndicator />
          ) : (
            <View style={{ alignItems: "center" }}>
              <PieChart
                data={toPieData(pieExpense, "ไม่มีข้อมูลรายจ่าย")}
                width={chartWidth - 16}
                height={210}
                accessor={"population"}
                backgroundColor={"transparent"}
                paddingLeft={"0"}
                absolute={false}
                hasLegend={true}
                chartConfig={DEFAULT_CHART_CONFIG}
              />
              <Text style={styles.subNote}>
                รวมทั้งหมด {baht(pieExpense.reduce((s, x) => s + (x?.amount || 0), 0))} บาท
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E1116" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingTop: 0,
    justifyContent: "space-between",

  },
  headerTitle: { color: "#E6E9EF", fontSize: 16, fontWeight: "600" },
  yearBtn: {
    width: 38,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1C212B",
  },
  yearBtnText: { color: "#E6E9EF", fontSize: 18, fontWeight: "700" },
  yearPill: {
    alignSelf: "center",
    backgroundColor: "#1C212B",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  yearPillText: { color: "#C7CCD6", fontSize: 14 },
  card: {
    backgroundColor: "#15171B",
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1F2430",
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7, // ให้เป็นวงกลม (ถ้าอยากเป็นสี่เหลี่ยมก็ลบออก)
  },
  noteText: {
    marginLeft: 6,
    fontSize: 14,
    color: "#ffffff8e",
  },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  cardTitle: { color: "#E6E9EF", fontSize: 16, fontWeight: "600" },
  note: { color: "#8F97A8", fontSize: 12, marginTop: 6, textAlign: "center" },
  subNote: { color: "#8F97A8", fontSize: 12, marginTop: 2 },
  yTick: { color: "#8F97A8", fontSize: 11 },
});
