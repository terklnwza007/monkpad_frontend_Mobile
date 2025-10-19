import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { registerUser, loginRequest } from "../lib/api";
import { saveToken } from "../lib/auth";


export default function SignupScreen({ navigation }) {
  const [username, setUsername] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);

  const validate = () => {
    if (!username || !email || !password || !confirm) {
      Alert.alert("ข้อผิดพลาด", "กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return false;
    }
    const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!okEmail) {
      Alert.alert("อีเมลไม่ถูกต้อง", "โปรดตรวจสอบรูปแบบอีเมล");
      return false;
    }
    if (password.length < 6) {
      Alert.alert("รหัสผ่านสั้นเกินไป", "ควรยาวอย่างน้อย 6 ตัวอักษร");
      return false;
    }
    if (password !== confirm) {
      Alert.alert("รหัสผ่านไม่ตรงกัน", "กรุณาตรวจสอบรหัสผ่านอีกครั้ง");
      return false;
    }
    return true;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await registerUser({ username: username.trim(), email: email.trim(), password });
      // สมัครสำเร็จ → ล็อกอินให้อัตโนมัติ
      const resp = await loginRequest(username.trim(), password);
      await saveToken(resp.access_token);
      navigation.replace("Login");
    } catch (e) {
      Alert.alert("สมัครไม่สำเร็จ", e?.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>JodMonk</Text>
        <Text style={styles.subtitle}>สร้างบัญชีใหม่</Text>

        <View style={styles.field}>
          <Text style={styles.label}>ชื่อผู้ใช้</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="username"
            placeholderTextColor="#8B93A6"
            returnKeyType="next"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>อีเมล</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="you@example.com"
            placeholderTextColor="#8B93A6"
            returnKeyType="next"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>รหัสผ่าน</Text>
          <View style={{ position: "relative" }}>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#8B93A6"
              secureTextEntry={!showPw}
              returnKeyType="next"
            />
            <Pressable style={styles.eye} onPress={() => setShowPw(s => !s)}>
              <Text style={styles.eyeText}>{showPw ? "Hide" : "Show"}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>ยืนยันรหัสผ่าน</Text>
          <TextInput
            style={styles.input}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="••••••••"
            placeholderTextColor="#8B93A6"
            secureTextEntry={!showPw}
            returnKeyType="done"
            onSubmitEditing={onSubmit}
          />
        </View>

        <Pressable
          style={[styles.button, loading && { opacity: 0.8 }]}
          onPress={onSubmit}
          disabled={loading}
        >
          {loading ? <ActivityIndicator /> : <Text style={styles.buttonText}>สมัครสมาชิก</Text>}
        </Pressable>

        <Pressable onPress={() => navigation.replace("Login")}>
          <Text style={styles.helper}>มีบัญชีแล้ว? <Text style={styles.helperLink}>เข้าสู่ระบบ</Text></Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const BG = "#0B1220";
const CARD = "#101827";
const BORDER = "#1E293B";
const TEXT = "#E5E7EB";
const MUTED = "#9CA3AF";
const ACCENT = "#22C55E"; // สีปุ่มสมัครให้ต่างจากปุ่มล็อกอิน

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: BG, paddingHorizontal: 24, justifyContent: "center",
  },
  card: {
    backgroundColor: CARD, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: BORDER,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  brand: { fontSize: 28, fontWeight: "800", color: TEXT, textAlign: "center" },
  subtitle: { color: MUTED, textAlign: "center", marginTop: 6, marginBottom: 18 },
  field: { marginBottom: 14 },
  label: { color: MUTED, marginBottom: 6 },
  input: {
    backgroundColor: "#0F172A", borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, color: TEXT,
  },
  eye: { position: "absolute", right: 10, top: 10, padding: 6 },
  eyeText: { color: MUTED, fontSize: 12 },
  button: { backgroundColor: ACCENT, paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 6 },
  buttonText: { color: "white", fontWeight: "700", fontSize: 16 },
  helper: { color: MUTED, textAlign: "center", marginTop: 12 },
  helperLink: { color: ACCENT, fontWeight: "600" },
});
