// src/screens/SettingsScreen.js
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getUserById,
  changeMyPassword,
  changeMyUsername,
  changeMyEmail,
} from "../lib/api";
import { getToken } from "../lib/auth";
import { getUidFromToken } from "../lib/jwt";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();

  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  // แยกโหลดของแต่ละ modal เพื่อไม่ให้ติดค้าง
  const [saving, setSaving] = useState({
    name: false,
    email: false,
    password: false,
  });

  // modal state
  const [modal, setModal] = useState(null); // 'name' | 'email' | 'password' | null
  const [form, setForm] = useState({
    new_username: "",
    new_email: "",
    password: "",
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  const resetForm = () =>
    setForm({
      new_username: "",
      new_email: "",
      password: "",
      old_password: "",
      new_password: "",
      confirm_password: "",
    });

  const closeModal = () => {
    setModal(null);
    resetForm();
    setSaving({ name: false, email: false, password: false });
  };

  const loadMe = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const uid = await getUidFromToken(token);
      const data = await getUserById(token, uid);
      setUsername(data?.username || "");
      setEmail(data?.email || "");
    } catch (e) {
      Alert.alert("ผิดพลาด", e.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  // ----- actions -----
  const onSaveUsername = async () => {
    const newname = form.new_username.trim();
    if (!newname || !form.password) {
      Alert.alert("กรอกไม่ครบ", "กรอกชื่อผู้ใช้ใหม่และรหัสผ่านปัจจุบัน");
      return;
    }
    if (newname === username) {
      Alert.alert("ยังไม่เปลี่ยน", "ชื่อผู้ใช้ใหม่เหมือนเดิม");
      return;
    }
    try {
      setSaving((s) => ({ ...s, name: true }));
      const token = await getToken();
      await changeMyUsername(token, { new_username: newname, password: form.password });
      setUsername(newname);
      closeModal();
      Alert.alert("สำเร็จ", "เปลี่ยนชื่อผู้ใช้เรียบร้อย");
    } catch (e) {
      Alert.alert("เปลี่ยนชื่อไม่สำเร็จ", e.message || "เกิดข้อผิดพลาด");
    } finally {
      setSaving((s) => ({ ...s, name: false }));
    }
  };

  const onSaveEmail = async () => {
    const newmail = form.new_email.trim();
    if (!newmail || !form.password) {
      Alert.alert("กรอกไม่ครบ", "กรอกอีเมลใหม่และรหัสผ่านปัจจุบัน");
      return;
    }
    if (newmail === email) {
      Alert.alert("ยังไม่เปลี่ยน", "อีเมลใหม่เหมือนเดิม");
      return;
    }
    // เช็คฟอร์แมตคร่าว ๆ ฝั่งหน้า
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newmail);
    if (!emailOk) {
      Alert.alert("อีเมลไม่ถูกต้อง", "รูปแบบอีเมลไม่ถูกต้อง");
      return;
    }
    try {
      setSaving((s) => ({ ...s, email: true }));
      const token = await getToken();
      await changeMyEmail(token, { new_email: newmail, password: form.password });
      setEmail(newmail);
      closeModal();
      Alert.alert("สำเร็จ", "เปลี่ยนอีเมลเรียบร้อย");
    } catch (e) {
      Alert.alert("เปลี่ยนอีเมลไม่สำเร็จ", e.message || "เกิดข้อผิดพลาด");
    } finally {
      setSaving((s) => ({ ...s, email: false }));
    }
  };

  const onSavePassword = async () => {
    if (!form.old_password || !form.new_password) {
      Alert.alert("กรอกไม่ครบ", "กรอกรหัสผ่านเดิมและรหัสผ่านใหม่");
      return;
    }
    if (form.new_password.length < 8) {
      Alert.alert("สั้นเกินไป", "รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัว");
      return;
    }
    if (form.new_password !== form.confirm_password) {
      Alert.alert("รหัสผ่านไม่ตรงกัน", "โปรดยืนยันรหัสผ่านใหม่อีกครั้งให้ตรงกัน");
      return;
    }
    try {
      setSaving((s) => ({ ...s, password: true }));
      const token = await getToken();
      await changeMyPassword(token, {
        old_password: form.old_password,
        new_password: form.new_password,
      });
      closeModal();
      Alert.alert("สำเร็จ", "เปลี่ยนรหัสผ่านเรียบร้อย");
    } catch (e) {
      Alert.alert("เปลี่ยนรหัสผ่านไม่สำเร็จ", e.message || "เกิดข้อผิดพลาด");
    } finally {
      setSaving((s) => ({ ...s, password: false }));
    }
  };

  const onLogout = async () => {
    try {
      await AsyncStorage.removeItem("token");
    } catch {}
    nav.reset({ index: 0, routes: [{ name: "Login" }] });
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0B0C" }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0B0C" }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: "#fff" }}>การตั้งค่า</Text>
      </View>

      {/* card */}
      <View style={styles.card}>
        {/* Username field + edit button */}
        <FieldLabel>ชื่อผู้ใช้</FieldLabel>
        <View style={{ position: "relative" }}>
          <TextInput
            value={username}
            editable={false}
            placeholder="username"
            style={styles.input}
            placeholderTextColor="#B8B8BF"
          />
          <Pressable
            style={styles.editChip}
            onPress={() => {
              setForm((s) => ({ ...s, new_username: username, password: "" }));
              setModal("name");
            }}
          >
            <Ionicons name="create-outline" size={14} color="#0B0B0C" />
          </Pressable>
        </View>

        {/* Email field + edit button */}
        <FieldLabel>อีเมล</FieldLabel>
        <View style={{ position: "relative" }}>
          <TextInput
            value={email}
            editable={false}
            placeholder="you@example.com"
            style={styles.input}
            placeholderTextColor="#B8B8BF"
          />
          <Pressable
            style={styles.editChip}
            onPress={() => {
              setForm((s) => ({ ...s, new_email: email, password: "" }));
              setModal("email");
            }}
          >
            <Ionicons name="create-outline" size={14} color="#0B0B0C" />
          </Pressable>
        </View>

        {/* Password row */}
        <FieldLabel>รหัสผ่าน</FieldLabel>
        <Pressable style={styles.passwordBtn} onPress={() => setModal("password")}>
          <Text style={styles.passwordBtnText}>เปลี่ยนรหัสผ่าน</Text>
          <Ionicons name="arrow-forward" size={18} color="#0B0B0C" />
        </Pressable>

        {/* logout bottom */}
        <View style={{ flex: 1 }} />
        <View style={{ paddingBottom: Math.max(16, insets.bottom) }}>
          <Pressable style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutText}>ออกจากระบบ</Text>
            <Ionicons name="log-out-outline" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* ======= Modals ======= */}
      <EditModal visible={modal === "name"} title="เปลี่ยนชื่อผู้ใช้" onClose={closeModal}>
        <LabeledInput
          label="ชื่อผู้ใช้ใหม่"
          value={form.new_username}
          onChangeText={(v) => setForm((s) => ({ ...s, new_username: v }))}
          placeholder="Username"
          autoCapitalize="none"
        />
        <LabeledInput
          label="รหัสผ่านปัจจุบัน"
          value={form.password}
          onChangeText={(v) => setForm((s) => ({ ...s, password: v }))}
          placeholder="••••••••"
          secureTextEntry
        />
        <PrimarySave onPress={onSaveUsername} loading={saving.name} />
      </EditModal>

      <EditModal visible={modal === "email"} title="เปลี่ยนอีเมล" onClose={closeModal}>
        <LabeledInput
          label="อีเมลใหม่"
          value={form.new_email}
          onChangeText={(v) => setForm((s) => ({ ...s, new_email: v }))}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <LabeledInput
          label="รหัสผ่านปัจจุบัน"
          value={form.password}
          onChangeText={(v) => setForm((s) => ({ ...s, password: v }))}
          placeholder="••••••••"
          secureTextEntry
        />
        <PrimarySave onPress={onSaveEmail} loading={saving.email} />
      </EditModal>

      <EditModal visible={modal === "password"} title="เปลี่ยนรหัสผ่าน" onClose={closeModal}>
        <LabeledInput
          label="รหัสผ่านเดิม"
          value={form.old_password}
          onChangeText={(v) => setForm((s) => ({ ...s, old_password: v }))}
          placeholder="••••••••"
          secureTextEntry
        />
        <LabeledInput
          label="รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)"
          value={form.new_password}
          onChangeText={(v) => setForm((s) => ({ ...s, new_password: v }))}
          placeholder="••••••••"
          secureTextEntry
        />
        <LabeledInput
          label="ยืนยันรหัสผ่านใหม่"
          value={form.confirm_password}
          onChangeText={(v) => setForm((s) => ({ ...s, confirm_password: v }))}
          placeholder="••••••••"
          secureTextEntry
        />
        <PrimarySave onPress={onSavePassword} loading={saving.password} />
      </EditModal>
    </SafeAreaView>
  );
}

/* ---------- small components ---------- */
const FieldLabel = ({ children }) => (
  <Text style={{ marginTop: 14, marginBottom: 6, color: "#0B0B0C", fontWeight: "600" }}>
    {children}
  </Text>
);

const LabeledInput = ({ label, ...inputProps }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={{ marginBottom: 6, color: "#111827", fontWeight: "600" }}>{label}</Text>
    <TextInput style={styles.input} placeholderTextColor="#B8B8BF" {...inputProps} />
  </View>
);

const EditModal = ({ visible, title, children, onClose }) => (
  <Modal visible={visible} animationType="slide" transparent>
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalCard}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#0B0B0C", flex: 1 }}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color="#0B0B0C" />
            </Pressable>
          </View>
          {children}
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  </Modal>
);

const PrimarySave = ({ onPress, loading }) => (
  <Pressable style={[styles.primaryBtn, loading && { opacity: 0.7 }]} onPress={loading ? undefined : onPress}>
    {loading ? (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <ActivityIndicator size="small" />
        <Text style={styles.primaryBtnText}>กำลังบันทึก...</Text>
      </View>
    ) : (
      <Text style={styles.primaryBtnText}>บันทึก</Text>
    )}
  </Pressable>
);

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F7F7FA",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    height: "100%",
    flexGrow: 0,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    color: "#0B0B0C",
  },
  editChip: {
    position: "absolute",
    right: 8,
    top: 8,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#E8EFFD",
    borderWidth: 1,
    borderColor: "#CFE0FF",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  editChipText: {
    color: "#0B0B0C",
    fontWeight: "600",
    fontSize: 12,
  },
  passwordBtn: {
    height: 48,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  passwordBtnText: {
    fontWeight: "600",
    color: "#0B0B0C",
  },
  logoutBtn: {
    height: 52,
    backgroundColor: "#E53935",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    flexDirection: "row",
  },
  logoutText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: 16,
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#F7F7FA",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
  },
  primaryBtn: {
    height: 48,
    backgroundColor: "#0B84FF",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
});
