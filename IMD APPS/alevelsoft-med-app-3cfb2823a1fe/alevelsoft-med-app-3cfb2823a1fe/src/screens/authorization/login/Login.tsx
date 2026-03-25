import { yupResolver } from '@hookform/resolvers/yup'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import React, { useCallback, useRef } from 'react'
import { FieldValues, useForm } from 'react-hook-form'
import { Alert, ScrollView, Text, TextInput, View } from 'react-native'
import { AvoidSoftInputView } from 'react-native-avoid-softinput'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Queue, Stack } from 'react-native-spacing-system'
import { SubmitButton } from 'src/components/form-button'
import { Input } from 'src/components/form-input'
import { LinkButton } from 'src/components/link-button'
import { Loader } from 'src/components/loader'
import { constants } from 'src/constants'
import { RolesType } from 'src/enums/roles.enum'
import { checkEmergencyContacts } from 'src/helpers/check-emergency-contacts'
import { showErrorMessage } from 'src/helpers/show-error-message'
import { validation } from 'src/helpers/verification-rules'
import { AuthStackParamList } from 'src/navigation/auth.stack'
import { useAppDispatch } from 'src/stores/hooks'
import { usePostSignInMutation } from 'src/stores/services/auth.api'
import { useLazyGetPatientEmergencyContactsQuery } from 'src/stores/services/emergency-contact.api'
import {
  setAccessTokenExpireTime,
  setEmail,
  setIsDisplayRecovery,
  setRefreshToken,
  setRegisteredUser,
  setToken,
} from 'src/stores/slices/auth.slice'
import { PostSignInRequest } from 'src/stores/types/post-sign-in-request.types'
import { Colors } from 'src/styles'

import styles from './styles'

enum AuthErrorMessage {
  notConfirmed = 'User is not confirmed.',
}

enum NavLog {
  forgot = 'ForgotPassword',
  confirm = 'ConfirmSignUp',
}

const Login = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>()
  const dispatch = useAppDispatch()
  const {
    control,
    handleSubmit,
    formState: { errors, isDirty, isValid },
  } = useForm<PostSignInRequest>({
    defaultValues: { email: '', password: '', rememberMe: false },
    mode: 'onChange',
    resolver: yupResolver(validation.login),
  })
  const refEmail = useRef<TextInput>(null)
  const refPassword = useRef<TextInput>(null)

  const [login] = usePostSignInMutation()
  const [lazyGetPatientEmergencyContacts, { isLoading: isLoadingEmergency }] = useLazyGetPatientEmergencyContactsQuery()

  const navigateToConfirm = useCallback(
    (email: string) => {
      dispatch(setEmail(email))
      navigation.navigate(NavLog.confirm)
    },
    [dispatch, navigation],
  )

  const navigateToForgotPassword = useCallback(() => navigation.navigate('ForgotPassword'), [navigation])

  const handleLogin = useCallback(
    async ({ email, password }: FieldValues) => {
      try {
        const { accessToken, refreshToken, accessTokenExpireTime, user } = await login({
          email,
          password,
          rememberMe: true,
        }).unwrap()

        if (user?.deletedAt) {
          dispatch(setIsDisplayRecovery(true))
        }

        if (accessToken) {
          dispatch(setToken(accessToken))
          dispatch(setAccessTokenExpireTime(accessTokenExpireTime))
          dispatch(setRefreshToken(refreshToken))

          // Set user/role BEFORE checking emergency contacts so Wrapper
          // can evaluate navigation immediately (prevents spinner-of-death)
          dispatch(
            setRegisteredUser({
              ...user,
              fullName: `${user.firstName} ${user.lastName}`,
            }),
          )

          if (user.role === RolesType.patient) {
            await checkEmergencyContacts(dispatch, isLoadingEmergency, lazyGetPatientEmergencyContacts)
          }
        }
      } catch (error: any) {
        if (error?.data.message === AuthErrorMessage.notConfirmed) {
          Alert.alert('Not confirmed account', 'Do you want to confirm your account?', [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            { text: 'Yes', onPress: () => navigateToConfirm(email) },
          ])
        } else {
          showErrorMessage(dispatch, error?.data.message)
        }
      }
    },
    [dispatch, isLoadingEmergency, lazyGetPatientEmergencyContacts, login, navigateToConfirm],
  )

  if (isLoadingEmergency) {
    return <Loader />
  }

  return (
    <SafeAreaView style={styles.containerStyle}>
      <ScrollView
        contentContainerStyle={styles.scrollWrapper}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled">
        <AvoidSoftInputView easing="easeIn" style={styles.wrapper}>
          <View style={styles.inputWrapper}>
            <Text style={styles.title}>Sign In</Text>
            <Stack size={30} />
            <Input
              autoCapitalize="none"
              autoCorrect={false}
              containerStyle={errors?.email && styles.inputErrorStyle}
              control={control}
              keyboardType="email-address"
              name="email"
              onSubmitEditing={() => refPassword.current?.focus()}
              placeholder="e.g. johndoe@example.com"
              placeholderTextColor={Colors.placeholder}
              returnKeyType="next"
              testID="loginEmail"
              textContentType="emailAddress"
              textRef={refEmail}
              titleField="Email"
            />
            <Input
              autoCapitalize="none"
              autoComplete="password"
              containerStyle={errors?.password && styles.inputErrorStyle}
              control={control}
              isPassword
              name="password"
              placeholder="e.g. P@S5worD"
              placeholderTextColor={Colors.placeholder}
              returnKeyType="done"
              secureTextEntry
              testID="loginPassword"
              textContentType="password"
              textRef={refPassword}
              titleField="Password"
            />
            <LinkButton
              alignment="center"
              containerViewStyle={styles.linkContainer}
              onPress={navigateToForgotPassword}
              testID="loginForgotPasswordButton"
              textStyles={styles.linkForgotStyle}
              title="Forgot Password?"
            />
          </View>
          <Stack size={30} />
          <View>
            <SubmitButton
              disabled={!isDirty || !isValid}
              disabledButtonStyle={[styles.viewContainerStyle, styles.opacity]}
              onPress={handleSubmit(handleLogin)}
              testID="signInButton"
              text="SIGN IN"
              type="submit"
            />
            <Stack size={50} />
            <View style={styles.accountViewStyle}>
              <Text style={styles.textStyle}>DON'T HAVE AN ACCOUNT?</Text>
              <Queue size={5} />
              <LinkButton
                alignment="center"
                containerViewStyle={styles.accountViewContainer}
                onPress={() => navigation.navigate(constants.CHOOSE_ROLE as never)}
                testID="createAccountButton"
                textStyles={styles.linkSingUpStyle}
                title="SIGN UP HERE"
              />
            </View>
          </View>
        </AvoidSoftInputView>
      </ScrollView>
    </SafeAreaView>
  )
}

export { Login }
