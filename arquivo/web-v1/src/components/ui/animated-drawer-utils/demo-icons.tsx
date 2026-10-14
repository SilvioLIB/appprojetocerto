import {
  Ban,
  EyeOff,
  FileKey,
  KeyRound,
  Lock,
  ScanFace,
  Shield,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

type IconProps = {
  className?: string;
  size?: number;
};

/**
 * Icon set used by the AnimatedDrawer demo. These are thin wrappers around
 * lucide-react icons so the drawer stays self-contained and easy to restyle.
 */

export const LockIcon = ({ className, size = 20 }: IconProps) => (
  <Lock className={className} size={size} />
);

export const PassIcon = ({ className, size = 20 }: IconProps) => (
  <KeyRound className={className} size={size} />
);

export const WarningIcon = ({ className, size = 20 }: IconProps) => (
  <TriangleAlert className={className} size={size} />
);

export const DangerIcon = ({ className, size = 40 }: IconProps) => (
  <TriangleAlert
    className={className ?? "text-red-500"}
    size={size}
    strokeWidth={1.5}
  />
);

export const RecoveryPhraseIcon = ({ className, size = 40 }: IconProps) => (
  <FileKey
    className={className ?? "text-sky-400"}
    size={size}
    strokeWidth={1.5}
  />
);

export const ShieldIcon = ({ className, size = 22 }: IconProps) => (
  <ShieldCheck className={className} size={size} />
);

export const PhraseIcon = ({ className, size = 22 }: IconProps) => (
  <EyeOff className={className} size={size} />
);

export const BannedIcon = ({ className, size = 22 }: IconProps) => (
  <Ban className={className} size={size} />
);

export const FaceIDIcon = ({ className, size = 20 }: IconProps) => (
  <ScanFace className={className} size={size} />
);

export const SecurityIcon = ({ className, size = 22 }: IconProps) => (
  <Shield className={className} size={size} />
);
