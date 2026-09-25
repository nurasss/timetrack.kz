import { Redirect } from 'expo-router';
import React from 'react';

/**
 * Redirect root of the mobile app to the login screen. Without this file,
 * the Expo Router will attempt to render a default screen which is not
 * defined. We therefore forward to /login.
 */
export default function Index() {
  return <Redirect href="/login" />;
}