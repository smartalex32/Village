import { StyleSheet, Text, View } from "react-native";
import { Button, DateField, Field } from "@/src/components/ui";
import { colors, spacing } from "@/src/theme/tokens";
import {
  formatHouseholdDate,
  resolveHouseholdDateTime,
  type HouseholdDateTime,
} from "@/src/lib/dateTime";

export function HouseholdDateTimeFields({
  label,
  value,
  onChange,
  timeZone,
  preferredInstant,
  error,
  editable = true,
}: {
  label: string;
  value: HouseholdDateTime;
  onChange(value: HouseholdDateTime): void;
  timeZone: string;
  preferredInstant?: string;
  error?: string;
  editable?: boolean;
}) {
  const result = resolveHouseholdDateTime(value, timeZone, preferredInstant);
  return (
    <View style={styles.group}>
      <Text style={styles.label}>
        {label} · {timeZone.replace(/_/g, " ")}
      </Text>
      <View style={styles.row}>
        <View style={styles.half}>
          <DateField
            label={`${label} date`}
            accessibilityLabel={`${label} date`}
            placeholder="YYYY-MM-DD"
            value={value.date}
            editable={editable}
            onChangeText={(date) => onChange({ date, time: value.time })}
          />
        </View>
        <View style={styles.half}>
          <Field
            label={`${label} time (24-hour)`}
            accessibilityLabel={`${label} time (24-hour)`}
            placeholder="15:30"
            value={value.time}
            editable={editable}
            onChangeText={(time) => onChange({ date: value.date, time })}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
        </View>
      </View>
      {error || result.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error || result.error}
        </Text>
      ) : null}
      {result.ambiguous && result.iso ? (
        <>
          <Text style={styles.note}>
            Clocks repeat this time. Using{" "}
            {formatHouseholdDate(result.iso, timeZone, {
              timeZoneName: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
            .
          </Text>
          {editable
            ? result.occurrences?.map((occurrence, index) => (
                <Button
                  key={occurrence}
                  label={`${index === 0 ? "First" : "Second"} occurrence · ${formatHouseholdDate(occurrence, timeZone, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}`}
                  variant={
                    Math.floor(new Date(occurrence).getTime() / 60000) ===
                    Math.floor(new Date(result.iso!).getTime() / 60000)
                      ? "primary"
                      : "secondary"
                  }
                  onPress={() => onChange({ ...value, occurrence })}
                />
              ))
            : null}
        </>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  label: { color: colors.ink, fontWeight: "800" },
  row: { flexDirection: "row", gap: spacing.sm },
  half: { flex: 1, minWidth: 0 },
  error: { color: colors.danger, fontSize: 13 },
  note: { color: colors.muted, fontSize: 13 },
});
