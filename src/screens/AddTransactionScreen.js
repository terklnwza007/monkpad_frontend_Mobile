// src/screens/AddTransactionScreen.js
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
  Image,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";

import { getToken } from "../lib/auth";
import { getUidFromToken } from "../lib/jwt";
import { authedGet, addTransaction, BASE_URL } from "../lib/api";
import TagPickerModal from "../components/TagPickerModal";

const pad2 = (n) => String(n).padStart(2, "0");
const nowParts = () => {
  const d = new Date();
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
};
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

// ---- ตั้งปลายทาง OCR (แก้ให้ตรง .env ของคุณ) ----
const OCR_ENDPOINT = `${BASE_URL}/ocr/parse`;

export default function AddTransactionScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  // loading + submit
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // tags
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [showTagPicker, setShowTagPicker] = useState(false);

  // form
  const now = nowParts();
  const [value, setValue] = useState("");
  const [date, setDate] = useState(now.date);
  const [time, setTime] = useState(now.time);
  const [note, setNote] = useState("");

  // image & OCR
  const [imageUri, setImageUri] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  // pickers (use temp state for iOS confirm)
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [tempDate, setTempDate] = useState(parseDateStr(now.date));
  const [tempTime, setTempTime] = useState(parseTimeStrToDate(now.date, now.time));

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const uid = getUidFromToken(token);
        const tgs = await authedGet(`/tags/${uid}`, token);
        setTags(Array.isArray(tgs) ? tgs : []);
      } catch (e) {
        Alert.alert("Error", e?.message || "โหลดแท็กไม่สำเร็จ");
        setTags([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // open pickers
  const openDatePicker = () => {
    Keyboard.dismiss();
    setTempDate(parseDateStr(date));
    setShowDate(true);
  };
  const openTimePicker = () => {
    Keyboard.dismiss();
    setTempTime(parseTimeStrToDate(date, time));
    setShowTime(true);
  };

  // ANDROID change handlers (commit immediately)
  const onChangeDateAndroid = (evt, selected) => {
    if (evt.type === "dismissed") {
      setShowDate(false);
      return;
    }
    const d = selected || parseDateStr(date);
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const dd = pad2(d.getDate());
    setDate(`${y}-${m}-${dd}`);
    setShowDate(false);
  };
  const onChangeTimeAndroid = (evt, selected) => {
    if (evt.type === "dismissed") {
      setShowTime(false);
      return;
    }
    const d = selected || parseTimeStrToDate(date, time);
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    setTime(`${hh}:${mm}`);
    setShowTime(false);
  };

  // iOS commit/cancel
  const confirmDateIOS = () => {
    const y = tempDate.getFullYear();
    const m = pad2(tempDate.getMonth() + 1);
    const d = pad2(tempDate.getDate());
    setDate(`${y}-${m}-${d}`);
    setShowDate(false);
  };
  const cancelDateIOS = () => setShowDate(false);
  const confirmTimeIOS = () => {
    const hh = pad2(tempTime.getHours());
    const mm = pad2(tempTime.getMinutes());
    setTime(`${hh}:${mm}`);
    setShowTime(false);
  };
  const cancelTimeIOS = () => setShowTime(false);

  // pick image
  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("ต้องการสิทธิ์", "โปรดอนุญาตเข้าถึงรูปภาพเพื่ออัปโหลด");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        setImageUri(res.assets[0].uri);
      }
    } catch (e) {
      Alert.alert("ไม่สามารถเลือกภาพได้", e?.message || "เกิดข้อผิดพลาด");
    }
  };

  // call backend OCR
  const runOCR = async () => {
    if (!imageUri) {
      Alert.alert("ยังไม่มีรูป", "กรุณาเลือกรูปก่อน");
      return;
    }
    setOcrLoading(true);
    try {
      const token = await getToken();

      // เดา MIME จากนามสกุล (พอใช้ได้)
      const ext = (imageUri.split(".").pop() || "jpg").toLowerCase();
      const mime =
        ext === "png" ? "image/png" :
        ext === "heic" ? "image/heic" :
        "image/jpeg";

      const form = new FormData();
      form.append("file", { uri: imageUri, name: `upload.${ext}`, type: mime });

      const res = await fetch(OCR_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // อย่าเซ็ต Content-Type เอง ให้ fetch ใส่ boundary ให้
        },
        body: form,
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `HTTP ${res.status}`);
      }
      const j = await res.json();
      // j = { amount, date, time, text }
      if (j.amount) setValue(String(j.amount));
      if (j.date) setDate(j.date);
      if (j.time) setTime(j.time);

      if (!j.amount && !j.date && !j.time) {
        Alert.alert("ไม่พบข้อมูล", "OCR ยังไม่เจอจำนวนเงิน/วันที่/เวลา ลองรูปที่ชัดขึ้น");
      }
    } catch (e) {
      Alert.alert("OCR ผิดพลาด", e?.message || "โปรดลองใหม่");
    } finally {
      setOcrLoading(false);
    }
  };

  // submit
  const onSubmit = async () => {
    const token = await getToken();
    const uid = getUidFromToken(token);

    const valNum = Number(value);
    if (!selectedTag) return Alert.alert("กรุณาเลือกแท็ก");
    if (!isFinite(valNum)) return Alert.alert("มูลค่าไม่ถูกต้อง");
    if (!date) return Alert.alert("กรุณาเลือกวันที่");
    if (!/^\d{2}:\d{2}$/.test(time)) {
      return Alert.alert("เวลาไม่ถูกต้อง", "time must be in HH:MM format");
    }

    const payload = {
      user_id: uid,
      tag_id: selectedTag.id,
      value: valNum,
      date, // YYYY-MM-DD
      time, // HH:MM
      note: note?.trim() || undefined,
    };

    setSubmitting(true);
    try {
      await addTransaction(token, payload);
      navigation.goBack();
    } catch (e) {
      Alert.alert("เพิ่มรายการไม่สำเร็จ", e?.message || "โปรดลองอีกครั้ง");
    } finally {
      setSubmitting(false);
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
          {/* เนื้อหาแบบเลื่อน */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              padding: 16,
              paddingBottom: insets.bottom ,
            }}
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          >
            {/* ==== ฟอร์ม ==== */}
            <View>
              <View style={s.ocrBox}>
                <Text style={{ fontWeight: "700", color: "#000", fontSize: 16, marginBottom: 6 }}>
                  อัปโหลดรูปภาพบิล/สลิป
                </Text>
                <Text style={{ color: "#6B7280", fontSize: 13 }}>ไฟล์ PNG, JPG</Text>

                {imageUri ? (
                  <View style={[s.previewRow, { marginTop: 12 }]}>
                    <Image source={{ uri: imageUri }} style={s.previewImg} />
                    <View style={{ flex: 1 }}>
                      <Pressable
                        onPress={runOCR}
                        style={[s.btnSm, { marginBottom: 8 }, ocrLoading && { opacity: 0.7 }]}
                        disabled={ocrLoading}
                      >
                        {ocrLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnSmText}>อ่านข้อความจากรูป</Text>}
                      </Pressable>
                      <Pressable onPress={() => setImageUri(null)} style={s.btnSmAlt}>
                        <Text style={s.btnSmAltText}>ลบรูปนี้</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable onPress={pickImage} style={s.uploadBtn}>
                    <Text style={s.uploadBtnText}>Upload</Text>
                  </Pressable>
                )}
              </View>

              <Text style={s.label}>จำนวนเงิน</Text>
              <TextInput
                style={s.input}
                value={value}
                onChangeText={setValue}
                keyboardType="decimal-pad"
                placeholder="เช่น 120.50"
                placeholderTextColor="#94A3B8"
                returnKeyType="done"
              />

              <Text style={s.label}>วันที่</Text>
              <Pressable onPress={openDatePicker}>
                <View pointerEvents="none">
                  <TextInput
                    style={s.input}
                    value={date}
                    editable={false}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </Pressable>

              <Text style={s.label}>เวลา</Text>
              <Pressable onPress={openTimePicker}>
                <View pointerEvents="none">
                  <TextInput
                    style={s.input}
                    value={time}
                    editable={false}
                    placeholder="HH:MM"
                    placeholderTextColor="#94A3B8"
                  />
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
                onPress={() => {
                  Keyboard.dismiss();
                  setShowTagPicker(true);
                }}
                style={[s.input, { justifyContent: "center", minHeight: 44 }]}
              >
                <Text style={{ color: selectedTag ? "#0F172A" : "#94A3B8" }}>
                  {selectedTag ? `${selectedTag.tag}` : "เลือกแท็ก"}
                </Text>
              </Pressable>
            </View>

            {/* Spacer เผื่อหน้าจอยาว */}
            <View style={{ height: 12 }} />
          </ScrollView>

          {/* ==== ปุ่มล่าง: แยกส่วนชัดเจน จะถูก KAV ดันขึ้นเองบน iOS ==== */}
          <View style={[s.footerBar, { paddingBottom: insets.bottom + 16 }]}>
            <Pressable
              style={[s.btn, submitting && { opacity: 0.75 }]}
              onPress={onSubmit}
              disabled={submitting}
            >
              <Text style={s.btnText}>{submitting ? "กำลังบันทึก..." : "บันทึก"}</Text>
            </Pressable>
          </View>

          {/* ===== Pickers ===== */}
          {Platform.OS === "android" ? (
            showDate && (
              <DateTimePicker
                value={parseDateStr(date)}
                mode="date"
                display="default"
                onChange={onChangeDateAndroid}
              />
            )
          ) : (
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

          {Platform.OS === "android" ? (
            showTime && (
              <DateTimePicker
                value={parseTimeStrToDate(date, time)}
                mode="time"
                is24Hour
                display="default"
                onChange={onChangeTimeAndroid}
              />
            )
          ) : (
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
            loading={loading}
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

// --- StyleSheet ---
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

  // ปุ่มหลักด้านล่าง
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

  // กล่องอัปโหลดรูป
  ocrBox: {
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  uploadBtn: {
    backgroundColor: "#000",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  uploadBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  previewRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  previewImg: {
    width: 84,
    height: 84,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  btnSm: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  btnSmText: { color: "#fff", fontWeight: "700" },
  btnSmAlt: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  btnSmAltText: { color: "#000", fontWeight: "700" },

  // Modal date/time
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
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalOk: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  modalCancel: { backgroundColor: "#fff", borderColor: "#CBD5E1" },
  modalBtnText: { color: "#fff", fontWeight: "700" },
  modalBtnTextAlt: { color: "#0F172A", fontWeight: "700" },
});
