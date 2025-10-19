import React, { useEffect, useState } from "react";
import { View, Text, Button } from "react-native";
import { authedGet } from "../lib/api";
import { getToken, clearToken } from "../lib/auth";
import { getUidFromToken } from "../lib/jwt";

export default function HomeScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) {
        navigation.replace("Login");
        return;
      }
      try {
        const uid = getUidFromToken(token);
        const me = await authedGet(`/users/${uid}`, token);
        setProfile(me);
      } catch (e) {
        setError(e?.message || "Failed to load profile");
      }
    })();
  }, [navigation]);

  const doLogout = async () => {
    await clearToken();
    navigation.replace("Login");
  };

  return (
    <View>
      <Text>Home</Text>
      {error ? (
        <Text>Error: {String(error)}</Text>
      ) : (
        <Text>{profile ? JSON.stringify(profile) : "Loading..."}</Text>
      )}
      <Button title="Logout" onPress={doLogout} />
    </View>
  );
}
