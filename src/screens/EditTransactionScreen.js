// src/screens/EditTransactionScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Modal,
  ScrollView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import DateTimePicker from "@react-native-community/datetimepicker";
import { getToken } from "../lib/auth";
import { getUidFromToken } from "../lib/jwt";
import { authedGet, updateTransaction } from "../lib/api";
import TagPickerModal from "../components/TagPickerModal";

const pad2 = (n) => String(n).padStart(2, "0");
const parseDateStr = (s) => {
  const [y, m, d] = (s || "").split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
};
const parseTimeStrToDate = (dateStr, timeStr) => {
  const d = parseDateStr(dateStr);
  const [hh, mm] = (timeStr || "00:00").split(":").map(Number);
  d.setHours(hh || 0, mm || 0, 0, 0);
  return d;
};

export default function EditTransactionScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const original = route?.params?.item || {};

  // load tags
  const [loadingTags, setLoadingTags] = useState(true);
  const [tags, setTags] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const uid = getUidFromToken(token);
        const res = await authedGet(`/tags/${uid}`, token);
        setTags(Array.isArray(res) ? res : []);
      } catch {
        setTags([]);
      } finally {
        setLoadingTags(false);
      }
    })();
  }, []);

  // form
  const [value, setValue] = useState(original?.value != null ? String(original.value) : "");
  const [date, setDate] = useState(original?.date || "");
  const [time, setTime] = useState((original?.time || "").slice(0, 5));
  const [note, setNote] = useState(original?.note || "");
  const [selectedTag, setSelectedTag] = useState(
    original?.tag_id ? { id: original.tag_id, tag: original.tag, type: original.type } : null
  );
  const [updating, setUpdating] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);

  // pickers
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [tempDate, setTempDate] = useState(parseDateStr(date || "1970-01-01"));
  const [tempTime, setTempTime] = useState(parseTimeStrToDate(date || "1970-01-01", time || "00:00"));

  const openDatePicker = () => {
    Keyboard.dismiss();
    setTempDate(parseDateStr(date || "1970-01-01"));
    setShowDate(true);
  };
  const openTimePicker = () => {
    Keyboard.dismiss();
    setTempTime(parseTimeStrToDate(date || "1970-01-01", time || "00:00"));
    setShowTime(true);
  };

  // android pickers
  const onChangeDateAndroid = (evt, selected) => {
    if (evt.type === "dismissed") return setShowDate(false);
    const d = selected || parseDateStr(date || "1970-01-01");
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const dd = pad2(d.getDate());
    setDate(`${y}-${m}-${dd}`);
    setShowDate(false);
  };
  const onChangeTimeAndroid = (evt, selected) => {
    if (evt.type === "dismissed") return setShowTime(false);
    const d = selected || parseTimeStrToDate(date || "1970-01-01", time || "00:00");
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    setTime(`${hh}:${mm}`);
    setShowTime(false);
  };

  // iOS confirm/cancel
  const confirmDateIOS = () => {
    const y = tempDate.getFullYear();
    const m = pad2(tempDate.getMonth() + 1);
    const d = pad2(tempDate.getDate());
    setDate(`${y}-${m}-${d}`);
    setShowDate(false);
  };
  const confirmTimeIOS = () => {
    const hh = pad2(tempTime.getHours());
    const mm = pad2(tempTime.getMinutes());
    setTime(`${hh}:${mm}`);
    setShowTime(false);
  };
  const cancelDateIOS = () => setShowDate(false);
  const cancelTimeIOS = () => setShowTime(false);

  // submit
  const onSubmit = async () => {
    const token = await getToken();
    const valNum = Number(value);
    if (!selectedTag) return Alert.alert("กรุณาเลือกแท็ก");
    if (!isFinite(valNum)) return Alert.alert("มูลค่าไม่ถูกต้อง");
    if (!date) return Alert.alert("กรุณาเลือกวันที่");
    if (!/^\d{2}:\d{2}$/.test(time)) return Alert.alert("เวลาไม่ถูกต้อง");

    const partial = {
      tag_id: selectedTag.id,
      value: valNum,
      date,
      time,
      note: note?.trim() || undefined,
    };

    try {
      setUpdating(true);
      await updateTransaction(token, original.id, partial);
      navigation.goBack();
    } catch (e) {
      Alert.alert("แก้ไขรายการไม่สำเร็จ", e?.message || "โปรดลองอีกครั้ง");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }} edges={["left", "right"]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              padding: 16,
              paddingBottom: insets.bottom,
            }}
          >
           

            <Text style={s.label}>จำนวนเงิน</Text>
            <TextInput
              style={s.input}
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              placeholder="เช่น 120.50"
              placeholderTextColor="#94A3B8"
            />

            <Text style={s.label}>วันที่</Text>
            <Pressable onPress={openDatePicker}>
              <View pointerEvents="none">
                <TextInput style={s.input} value={date} editable={false} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" />
              </View>
            </Pressable>

            <Text style={s.label}>เวลา</Text>
            <Pressable onPress={openTimePicker}>
              <View pointerEvents="none">
                <TextInput style={s.input} value={time} editable={false} placeholder="HH:MM" placeholderTextColor="#94A3B8" />
              </View>
            </Pressable>

            <Text style={s.label}>บันทึก (ถ้ามี)</Text>
            <TextInput
              style={[s.input, { height: 80 }]}
              value={note}
              onChangeText={setNote}
              placeholder="รายละเอียดเพิ่มเติม"
              placeholderTextColor="#94A3B8"
              multiline
            />

            <Text style={[s.label, { marginTop: 8 }]}>แท็ก</Text>
            <Pressable
              onPress={() => setShowTagPicker(true)}
              style={[s.input, { justifyContent: "center", minHeight: 44 }]}
            >
              <Text style={{ color: selectedTag ? "#0F172A" : "#94A3B8" }}>
                {selectedTag ? `${selectedTag.tag}` : "เลือกแท็ก"}
              </Text>
            </Pressable>

            <View style={{ height: 12 }} />
          </ScrollView>

          <View style={[s.footerBar, { paddingBottom: insets.bottom + 16 }]}>
            <Pressable style={[s.btn, updating && { opacity: 0.75 }]} onPress={onSubmit} disabled={updating}>
              <Text style={s.btnText}>{updating ? "กำลังอัปเดต..." : "อัปเดต"}</Text>
            </Pressable>
          </View>

 

          {/* --- pickers --- */}
          {Platform.OS === "android"
            ? showDate && (
                <DateTimePicker
                  value={parseDateStr(date || "1970-01-01")}
                  mode="date"
                  display="default"
                  onChange={onChangeDateAndroid}
                />
              )
            : (
              <Modal visible={showDate} transparent animationType="slide" onRequestClose={() => setShowDate(false)}>
                <View style={s.modalBackdrop}>
                  <View style={s.modalSheetDate}>
                    <Text style={s.modalTitle}>เลือกวันที่</Text>
                    <DateTimePicker
                      value={tempDate}
                      mode="date"
                      display="inline"
                      onChange={(_, d) => d && setTempDate(d)}
                      themeVariant="light"
                      textColor="black"
                    />
                    <View style={s.modalActions}>
                      <Pressable style={[s.modalBtn, s.modalCancel]} onPress={cancelDateIOS}>
                        <Text style={s.modalBtnTextAlt}>ยกเลิก</Text>
                      </Pressable>
                      <Pressable style={[s.modalBtn, s.modalOk]} onPress={confirmDateIOS}>
                        <Text style={s.modalBtnText}>ยืนยัน</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </Modal>
            )}

          {Platform.OS === "android"
            ? showTime && (
                <DateTimePicker
                  value={parseTimeStrToDate(date || "1970-01-01", time || "00:00")}
                  mode="time"
                  is24Hour
                  display="default"
                  onChange={onChangeTimeAndroid}
                />
              )
            : (
              <Modal visible={showTime} transparent animationType="slide" onRequestClose={() => setShowTime(false)}>
                <View style={s.modalBackdrop}>
                  <View style={s.modalSheetTime}>
                    <Text style={s.modalTitle}>เลือกเวลา</Text>
                    <DateTimePicker
                      value={tempTime}
                      mode="time"
                      is24Hour
                      display="spinner"
                      onChange={(_, d) => d && setTempTime(d)}
                      themeVariant="light"
                      textColor="black"
                    />
                    <View style={s.modalActions}>
                      <Pressable style={[s.modalBtn, s.modalCancel]} onPress={cancelTimeIOS}>
                        <Text style={s.modalBtnTextAlt}>ยกเลิก</Text>
                      </Pressable>
                      <Pressable style={[s.modalBtn, s.modalOk]} onPress={confirmTimeIOS}>
                        <Text style={s.modalBtnText}>ยืนยัน</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </Modal>
            )}

          <TagPickerModal
            visible={showTagPicker}
            tags={tags}
            loading={loadingTags}
            selectedId={selectedTag?.id ?? null}
            onSelect={(tag) => {
              setSelectedTag(tag);
              setShowTagPicker(false);
            }}
            onClose={() => setShowTagPicker(false)}
            onCreated={(tag) => {
              setTags((prev) => {
                if (prev.some((t) => t.tag === tag.tag && t.user_id === tag.user_id)) return prev;
                return [...prev, tag];
              });
            }}
          />
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  h1: {
    fontSize: 20,
    fontWeight: "800",
    color: "#000",
    marginBottom: 12,
    textAlign: "center",
  },
  label: { color: "#000", marginTop: 8, marginBottom: 6, fontWeight: "600" },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#000",
    fontSize: 15,
  },
  btn: {
    backgroundColor: "#000",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 14,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  footerBar: {
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F8FAFC",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    padding: 16,
  },
  modalSheetDate: {
    borderRadius: 16,
    height: "55%",
    backgroundColor: "#fff",
    padding: 16,
  },
  modalSheetTime: {
    borderRadius: 16,
    height: "40%",
    backgroundColor: "#fff",
    padding: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 8 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 8 },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  modalOk: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  modalCancel: { backgroundColor: "#fff", borderColor: "#CBD5E1" },
  modalBtnText: { color: "#fff", fontWeight: "700" },
  modalBtnTextAlt: { color: "#0F172A", fontWeight: "700" },
});
