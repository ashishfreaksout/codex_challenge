import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TouchableWithoutFeedback,
  Keyboard
} from "react-native";
import { AlertTriangle, X } from "lucide-react-native";
import styled from "styled-components/native";

import { colors, radii, shadows } from "../theme";

const SEVERITIES = ["Low", "Medium", "High", "Critical"];

export default function ReportPotholeModal({
  visible,
  coordinate,
  locationMessage,
  onCancel,
  onSubmit
}) {
  const [severity, setSeverity] = useState("Medium");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (visible) {
      setSeverity("Medium");
      setNotes("");
    }
  }, [visible]);

  const handleSubmit = () => {
    onSubmit({ severity, notes });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ModalBackdrop>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%" }}
          >
            <Sheet>
              <SheetHeader>
                <TitleRow>
                  <TriangleBadge>
                    <AlertTriangle size={18} color={colors.warningDark} />
                  </TriangleBadge>
                  <SheetTitle>Report pothole</SheetTitle>
                </TitleRow>
                <CloseButton onPress={onCancel} accessibilityLabel="Close report form">
                  <X size={18} color={colors.textStrong} />
                </CloseButton>
              </SheetHeader>

              {coordinate ? (
                <CoordinateText>
                  {coordinate.latitude.toFixed(5)}, {coordinate.longitude.toFixed(5)}
                </CoordinateText>
              ) : null}

              {locationMessage ? <LocationMessage>{locationMessage}</LocationMessage> : null}

              <FieldLabel>Severity</FieldLabel>
              <SeverityRow>
                {SEVERITIES.map((option) => {
                  const selected = option === severity;
                  return (
                    <SeverityButton
                      key={option}
                      onPress={() => setSeverity(option)}
                      $selected={selected}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <SeverityText $selected={selected}>{option}</SeverityText>
                    </SeverityButton>
                  );
                })}
              </SeverityRow>

              <FieldLabel>Notes</FieldLabel>
              <NotesInput
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
                placeholder="Lane position, size, road hazard details"
                placeholderTextColor={colors.textMuted}
              />

              <Actions>
                <SecondaryButton onPress={onCancel}>
                  <SecondaryButtonText>Cancel</SecondaryButtonText>
                </SecondaryButton>
                <PrimaryButton onPress={handleSubmit}>
                  <PrimaryButtonText>Submit report</PrimaryButtonText>
                </PrimaryButton>
              </Actions>
            </Sheet>
          </KeyboardAvoidingView>
        </ModalBackdrop>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const ModalBackdrop = styled.View`
  flex: 1;
  justify-content: flex-end;
  background-color: rgba(15, 23, 42, 0.42);
`;

const Sheet = styled.View`
  margin: 14px;
  padding: 16px;
  border-radius: ${radii.panel}px;
  background-color: ${colors.surface};
  border-width: 1px;
  border-color: ${colors.border};
  ${shadows.panel}
`;

const SheetHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const TitleRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 10px;
`;

const TriangleBadge = styled.View`
  width: 34px;
  height: 34px;
  border-radius: 17px;
  align-items: center;
  justify-content: center;
  background-color: ${colors.reportedSurface};
`;

const SheetTitle = styled.Text`
  color: ${colors.textStrong};
  font-size: 20px;
  font-weight: 800;
`;

const CloseButton = styled(Pressable)`
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 17px;
  background-color: ${colors.control};
`;

const CoordinateText = styled.Text`
  color: ${colors.textMuted};
  font-size: 13px;
  margin-bottom: 6px;
`;

const LocationMessage = styled.Text`
  color: ${colors.warningDark};
  font-size: 13px;
  line-height: 18px;
  margin-bottom: 8px;
`;

const FieldLabel = styled.Text`
  color: ${colors.textStrong};
  font-size: 14px;
  font-weight: 800;
  margin-top: 12px;
  margin-bottom: 8px;
`;

const SeverityRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
`;

const SeverityButton = styled(Pressable)`
  min-height: 38px;
  padding: 0 13px;
  align-items: center;
  justify-content: center;
  border-radius: ${radii.control}px;
  border-width: 1px;
  border-color: ${({ $selected }) => ($selected ? colors.accent : colors.border)};
  background-color: ${({ $selected }) => ($selected ? colors.accentSoft : colors.surfaceStrong)};
`;

const SeverityText = styled.Text`
  color: ${({ $selected }) => ($selected ? colors.accent : colors.textStrong)};
  font-size: 13px;
  font-weight: 800;
`;

const NotesInput = styled.TextInput`
  min-height: 108px;
  padding: 12px;
  border-radius: ${radii.control}px;
  color: ${colors.textStrong};
  background-color: ${colors.surfaceStrong};
  border-width: 1px;
  border-color: ${colors.border};
  font-size: 14px;
`;

const Actions = styled.View`
  flex-direction: row;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
`;

const SecondaryButton = styled(Pressable)`
  min-height: 44px;
  padding: 0 16px;
  align-items: center;
  justify-content: center;
  border-radius: ${radii.control}px;
  background-color: ${colors.control};
`;

const SecondaryButtonText = styled.Text`
  color: ${colors.textStrong};
  font-size: 14px;
  font-weight: 800;
`;

const PrimaryButton = styled(Pressable)`
  min-height: 44px;
  padding: 0 18px;
  align-items: center;
  justify-content: center;
  border-radius: ${radii.control}px;
  background-color: ${colors.accent};
`;

const PrimaryButtonText = styled.Text`
  color: ${colors.white};
  font-size: 14px;
  font-weight: 800;
`;
