output "vpc_id" {
  description = "Dedicated staging VPC ID."
  value       = aws_vpc.staging.id
}

output "security_group_id" {
  description = "Runner security group ID. It intentionally has no ingress rules."
  value       = aws_security_group.runner.id
}

output "instance_id" {
  description = "Runner EC2 instance ID; null while instance creation is disabled."
  value       = try(aws_instance.runner[0].id, null)
}

output "private_ip" {
  description = "Runner private IP; null while instance creation is disabled."
  value       = try(aws_instance.runner[0].private_ip, null)
}

output "ssm_start_session_command" {
  description = "Use AWS Systems Manager Session Manager; no SSH key or inbound port is provisioned."
  value       = try("aws ssm start-session --target ${aws_instance.runner[0].id} --region ${var.aws_region}", null)
}
