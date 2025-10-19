// src/components/TagPickerModal.js
import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  FlatList,
  ActivityIndicator,
  TextInput,
  StyleSheet,
  Alert,
  Image,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { getToken } from "../lib/auth";
import { getUidFromToken } from "../lib/jwt";
import { authedGet, BASE_URL } from "../lib/api";

const DEFAULT_LOCKED = ["รายรับอื่นๆ", "รายจ่ายอื่นๆ"];

export default function TagPickerModal({
  visible,
  tags,
  loading,
  selectedId = null,
  onSelect,
  onClose,
  onCreated,
  onDeleted,
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(tags || []);
  useEffect(() => setItems(tags || []), [tags]);

  const [newTag, setNewTag] = useState("");
  const [newType, setNewType] = useState("expense");
  const [creating, setCreating] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [viewFilter, setViewFilter] = useState("all"); // all | income | expense

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const filtered = useMemo(() => {
    const k = query.trim().toLowerCase();
    if (!k) return items || [];
    return (items || []).filter((t) => String(t.tag).toLowerCase().includes(k));
  }, [items, query]);

  const visibleList = useMemo(() => {
    if (viewFilter === "all") return filtered;
    return (filtered || []).filter((t) => t.type === viewFilter);
  }, [filtered, viewFilter]);

  const handleClose = () => { setQuery(""); onClose?.(); };
  const handleSelect = (item) => { onSelect?.(item); setQuery(""); };

  const handleCreate = async () => {
    const name = newTag.trim();
    if (!name) return Alert.alert("กรอกชื่อแท็กก่อนนะ");
    if (!["income", "expense"].includes(newType)) {
      return Alert.alert("ชนิดแท็กไม่ถูกต้อง", "ต้องเป็น income หรือ expense");
    }

    try {
      setCreating(true);
      const token = await getToken();
      const uid = getUidFromToken(token);

      const res = await fetch(`${BASE_URL}/tags/add/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: uid, tag: name, type: newType }),
      });
      if (!res.ok) {
        let msg = `Create failed (${res.status})`;
        try { const j = await res.json(); if (j?.detail) msg = j.detail; } catch {}
        throw new Error(msg);
      }

      const all = await authedGet(`/tags/${uid}`, token);
      const created = (Array.isArray(all) ? all : []).find(
        (t) => String(t.tag).trim().toLowerCase() === name.toLowerCase() && t.type === newType
      );
      if (!created) throw new Error("ไม่พบแท็กที่สร้างใหม่ กรุณาลองอีกครั้ง");

      if (mounted.current) setItems((prev) => [created, ...prev]);
      onCreated?.(created);
      onSelect?.(created);

      setNewTag("");
      setNewType("expense");
      setQuery("");
      onClose?.();
    } catch (e) {
      Alert.alert("สร้างแท็กไม่สำเร็จ", e?.message || "โปรดลองอีกครั้ง");
    } finally {
      if (mounted.current) setCreating(false);
    }
  };

  const openDelete = (item) => {
    if (DEFAULT_LOCKED.includes(item.tag)) {
      return Alert.alert("ลบไม่ได้", `"${item.tag}" เป็นแท็กตั้งต้น ไม่สามารถลบได้`);
    }
    setDeleteTarget(item);
    setConfirmName("");
    setDeleteModalOpen(true);
  };

  const performDelete = async () => {
    if (!deleteTarget) return;
    const nameTyped = confirmName.trim();
    if (!nameTyped) return Alert.alert("โปรดพิมพ์ชื่อแท็กให้ตรง");
    if (nameTyped !== String(deleteTarget.tag).trim()) {
      return Alert.alert("ชื่อไม่ตรง", "พิมพ์ให้ตรงเป๊ะก่อนลบ");
    }

    const snapshot = items;
    const nextList = snapshot.filter((t) => t.id !== deleteTarget.id);
    setItems(nextList);
    setDeleteModalOpen(false);

    if (selectedId === deleteTarget.id) onSelect?.(null);
    onDeleted?.(nextList);

    try {
      setDeleting(true);
      const token = await getToken();
      const uid = getUidFromToken(token);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${BASE_URL}/tags/delete/${uid}/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      clearTimeout(timer);
      if (!res.ok) {
        let detail = `Delete failed (${res.status})`;
        try { const j = await res.json(); if (j?.detail) detail = j.detail; } catch {}
        if (mounted.current) { setItems(snapshot); onDeleted?.(snapshot); }
        throw new Error(detail);
      }
    } catch (e) {
      Alert.alert(
        e.name === "AbortError" ? "เครือข่ายช้า" : "ลบแท็กไม่สำเร็จ",
        e.name === "AbortError" ? "ลบไม่สำเร็จเพราะหมดเวลา (timeout)" : (e?.message || "โปรดลองอีกครั้ง")
      );
    } finally {
      if (mounted.current) {
        setDeleting(false);
        setDeleteTarget(null);
        setConfirmName("");
      }
    }
  };

  const incomeSelected = newType === "income";
  const expenseSelected = newType === "expense";

  // ตัวแปรช่วยตรวจว่าพิมพ์ชื่อแท็กตรงหรือยัง
  const matchOk =
    (confirmName.trim() || "") === String(deleteTarget?.tag || "").trim();

  const TypePill = ({ type }) => (
    <View style={[s.typePill, type === "income" ? s.pillIncome : s.pillExpense]}>
      <MaterialCommunityIcons
        name={type === "income" ? "arrow-bottom-left-thin" : "arrow-top-right-thin"}
        size={14}
        color={type === "income" ? "#065F46" : "#7F1D1D"}
      />
      <Text style={[s.typePillText, type === "income" ? s.pillIncomeText : s.pillExpenseText]}>
        {type === "income" ? "รายรับ" : "รายจ่าย"}
      </Text>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={s.modalBackdrop}>
        <View style={s.modalSheet}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Text style={[s.modalTitle, { flex: 1 }]}>เลือกแท็ก</Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Text style={{ fontWeight: "700", color: "#0F172A" }}>ปิด</Text>
            </Pressable>
          </View>

          {/* เพิ่มแท็กใหม่ */}
          <View style={s.addBox}>
            <Text style={s.addTitle}>เพิ่มแท็กใหม่</Text>
            <TextInput
              style={[s.input, { marginBottom: 10 }]}
              value={newTag}
              onChangeText={setNewTag}
              placeholder="เช่น อาหาร, ค่าน้ำ, ค่าไฟ"
              placeholderTextColor="#94A3B8"
            />
            <View style={s.typeRow}>
              <Pressable
                onPress={() => setNewType("income")}
                style={[s.segment, incomeSelected && s.segmentActiveIncome]}
              >
                <Text style={[s.segmentText, incomeSelected && s.segmentTextActive]}>รายรับ</Text>
              </Pressable>

              <Pressable
                onPress={() => setNewType("expense")}
                style={[s.segment, expenseSelected && s.segmentActiveExpense]}
              >
                <Text style={[s.segmentText, expenseSelected && s.segmentTextActive]}>รายจ่าย</Text>
              </Pressable>

              <Pressable
                onPress={handleCreate}
                disabled={creating}
                style={[s.saveBtn, creating && { opacity: 0.7 }]}
              >
                <Text style={s.saveBtnText}>{creating ? "กำลังบันทึก..." : "บันทึก"}</Text>
              </Pressable>
            </View>
          </View>

          {/* Search bar */}
          <View style={{ position: "relative", marginBottom: 8 }}>
            <TextInput
              style={[s.input, { paddingLeft: 40, height: 44, paddingVertical: 10 }]}
              value={query}
              onChangeText={setQuery}
              placeholder="ค้นหาแท็ก"
              placeholderTextColor="#94A3B8"
            />
            <Image
              source={require("../../assets/icon/search.png")}
              style={{
                position: "absolute",
                left: 12,
                top: 12,
                width: 20,
                height: 20,
                tintColor: "#94A3B8",
                zIndex: 2,
              }}
              resizeMode="contain"
              pointerEvents="none"
            />
          </View>

          {/* Filter chips */}
          <View style={s.filterRow}>
            {[
              { key: "all", label: `ทั้งหมด (${filtered?.length || 0})` },
              { key: "income", label: "รายรับ" },
              { key: "expense", label: "รายจ่าย" },
            ].map((f) => {
              const active = viewFilter === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setViewFilter(f.key)}
                  style={[s.filterChip, active && s.filterChipActive]}
                  android_ripple={{ color: "#E5E7EB", borderless: false }}
                >
                  <Text style={[s.filterChipText, active && s.filterChipTextActive]}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* List */}
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 12 }} />
          ) : !visibleList?.length ? (
            <View style={{ alignItems: "center", marginTop: 12 }}>
              <MaterialCommunityIcons name="tag-off-outline" size={28} color="#94A3B8" />
              <Text style={s.muted}>ไม่พบแท็ก</Text>
            </View>
          ) : (
            <FlatList
              data={visibleList}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
              renderItem={({ item }) => {
                const locked = DEFAULT_LOCKED.includes(item.tag);
                const selected = selectedId === item.id;
                const isIncome = item.type === "income";

                return (
                  <View
                    style={[
                      s.cardRow,
                      selected && s.cardRowSelected,
                      Platform.OS === "android" ? s.cardRowAndroid : s.cardRowIOS,
                    ]}
                  >
                    <Pressable
                      onPress={() => handleSelect(item)}
                      android_ripple={{ color: "#EEF2FF" }}
                      style={s.cardPress}
                    >
                      

                      {/* Texts */}
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <Text numberOfLines={1} style={s.tagTitle}>{item.tag}</Text>
                          {locked && (
                            <MaterialCommunityIcons
                              name="lock-outline"
                              size={16}
                              color="#f59e0b"
                              style={{ marginLeft: 6 }}
                            />
                          )}
                        </View>
                        <TypePill type={item.type} />
                      </View>

                      {/* Right side */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {selected && (
                          <MaterialCommunityIcons name="check-circle" size={20} color="#2563EB" />
                        )}
                        {!locked && (
                          <Pressable
                            onPress={() => openDelete(item)}
                            hitSlop={8}
                            style={s.trashBtnRound}
                          >
                            <MaterialCommunityIcons name="trash-can-outline" size={18} color="#B91C1C" />
                          </Pressable>
                        )}
                      </View>
                    </Pressable>
                  </View>
                );
              }}
            />
          )}
        </View>

        {/* Confirm Delete Overlay (เวอร์ชันสวย) */}
        {deleteModalOpen && (
          <View style={s.overlayCover}>
            <View style={[s.confirmSheet, s.confirmCard]}>
              <View style={s.warnBadge}>
                <MaterialCommunityIcons name="alert-decagram-outline" size={28} color="#DC2626" />
              </View>

              <Text style={[s.confirmTitle, { textAlign: "center", marginTop: 4 }]}>
                ยืนยันการลบแท็ก
              </Text>

              <View style={s.tagChip}>
                <MaterialCommunityIcons name="tag-outline" size={16} color="#991B1B" />
                <Text style={s.tagChipText}>{deleteTarget?.tag}</Text>
              </View>

              <Text style={[s.confirmDesc, { textAlign: "center" }]}>
                พิมพ์ชื่อแท็กให้ตรงเพื่อยืนยันการลบถาวร การลบจะมีผลกับการเลือกแท็กในอนาคต
              </Text>

              <View style={s.inputWrap}>
                <TextInput
                  style={[s.input, s.inputLarge, !matchOk && confirmName ? s.inputDanger : null]}
                  value={confirmName}
                  onChangeText={setConfirmName}
                  placeholder={`พิมพ์ว่า: ${deleteTarget?.tag || ""}`}
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoFocus
                  returnKeyType="done"
                />
                <View style={s.inputIcon}>
                  {confirmName.length > 0 ? (
                    matchOk ? (
                      <MaterialCommunityIcons name="check-circle-outline" size={22} color="#16A34A" />
                    ) : (
                      <MaterialCommunityIcons name="close-circle-outline" size={22} color="#DC2626" />
                    )
                  ) : null}
                </View>
              </View>

              <View style={s.btnRow}>
                <Pressable
                  onPress={() => setDeleteModalOpen(false)}
                  disabled={deleting}
                  style={[s.btn, s.btnOutline]}
                >
                  <Text style={[s.btnText, s.btnOutlineText]}>ยกเลิก</Text>
                </Pressable>

                <Pressable
                  onPress={performDelete}
                  disabled={!matchOk || deleting}
                  style={[
                    s.btn,
                    s.btnDanger,
                    (!matchOk || deleting) && { opacity: 0.6 },
                  ]}
                >
                  <Text style={s.btnText}>{deleting ? "กำลังลบ..." : "ลบแท็ก"}</Text>
                </Pressable>
              </View>

              {!matchOk && !!confirmName && (
                <Text style={s.hintText}>ชื่อไม่ตรง กรุณาตรวจสอบอีกครั้ง</Text>
              )}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: "#0F172A",
  },
  muted: { color: "#64748B", textAlign: "center", marginTop: 6 },

  /* Header Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    padding: 16,
  },
  modalSheet: {
    borderRadius: 16,
    height: "70%",
    backgroundColor: "#fff",
    padding: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },

  /* Add new tag */
  addBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  addTitle: { fontWeight: "800", color: "#0F172A", marginBottom: 8 },
  typeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  segment: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#fff",
  },
  //  backgroundColor: "#16a34ae0", color: "#fff" 
  segmentActiveIncome : { backgroundColor: "#16a34ae0"},
  
  // backgroundColor: "#dc2626d5", color: "#fff" 
  segmentActiveExpense: { backgroundColor: "#dc2626d5"},
  segmentTextActive: { color: "#fff" },
  segmentText: { fontWeight: "700", color: "#334155" },
  
  saveBtn: {
    marginLeft: "auto",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#111827",
  },
  saveBtnText: { color: "#fff", fontWeight: "800" },

  /* Filter chips */
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  filterChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#fff",
  },
  filterChipActive: {
    backgroundColor: "#EEF2FF",
    borderColor: "#C7D2FE",
  },
  filterChipText: { color: "#334155", fontWeight: "700" },
  filterChipTextActive: { color: "#1D4ED8" },

  /* Card row (รายการแท็ก) */
  cardRow: {
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  cardRowSelected: {
    borderColor: "#2563EB",
    backgroundColor: "#EEF2FF",
  },
  cardRowAndroid: {
    elevation: 1,
  },
  cardRowIOS: {
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  cardPress: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
  },

  leadCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  leadIncome: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  leadExpense: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  leadText: { fontWeight: "900", color: "#0F172A" },

  tagTitle: { flexShrink: 1, color: "#0F172A", fontWeight: "800", fontSize: 15 },

  typePill: {
    alignSelf: "flex-start",
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillIncome: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  pillExpense: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  typePillText: { fontWeight: "800", fontSize: 12 },
  pillIncomeText: { color: "#065F46" },
  pillExpenseText: { color: "#7F1D1D" },

  trashBtnRound: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },

  /* ====== Overlay & Confirm Card ====== */
  overlayCover: {
    position: "absolute", left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center", justifyContent: "center",
    padding: 16, zIndex: 50,
  },
  confirmSheet: {
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 16,
    width: "100%",
  },
  confirmCard: {
    paddingTop: 22,
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  warnBadge: {
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  confirmTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  confirmDesc: { color: "#334155", marginTop: 6 },

  tagChip: {
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FEE2E2",
    marginTop: 8,
    marginBottom: 6,
  },
  tagChipText: { color: "#991B1B", fontWeight: "800" },

  inputWrap: { position: "relative", marginTop: 10 },
  inputLarge: { height: 48, paddingVertical: 12, paddingRight: 44 },
  inputDanger: { borderColor: "#FCA5A5", backgroundColor: "#FFF1F2" },
  inputIcon: { position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center" },

  btnRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  btn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontWeight: "800" },
  btnDanger: { backgroundColor: "#DC2626" },
  btnOutline: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  btnOutlineText: { color: "#0F172A", fontWeight: "800" },

  hintText: { marginTop: 8, textAlign: "center", color: "#B91C1C" },
});
