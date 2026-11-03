variable "aws_region" {
  description = "AWS region for the isolated staging runner. Mumbai is selected to align with the existing Supabase staging region."
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Stable project tag prefix."
  type        = string
  default     = "export-client-staging"
}

variable "instance_type" {
  description = "Small burstable instance suitable for schema inspection and fixture validation."
  type        = string
  default     = "t3.small"
}

variable "root_volume_size_gib" {
  description = "Encrypted root EBS volume size."
  type        = number
  default     = 30

  validation {
    condition     = var.root_volume_size_gib >= 20 && var.root_volume_size_gib <= 100
    error_message = "root_volume_size_gib must be between 20 and 100 GiB."
  }
}

variable "vpc_cidr" {
  description = "Dedicated VPC CIDR; must not overlap with any connected network."
  type        = string
  default     = "10.74.0.0/16"
}

variable "public_subnet_cidr" {
  description = "Public subnet CIDR used only for outbound SSM connectivity."
  type        = string
  default     = "10.74.1.0/24"
}

variable "enable_instance" {
  description = "Creation gate. Keep false until AWS account, budget, remote state, and GitHub OIDC are approved."
  type        = bool
  default     = false
}
